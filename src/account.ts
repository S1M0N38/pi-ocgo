import { chmod, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { PROVIDER } from "./usage.ts";

const ACCOUNTS_FILE = "ocgo.json";
const AUTH_FILE = "auth.json";
const AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";
const CREATED_FILE_MODE = 0o600;

/** Parsed `ocgo.json`, plus the raw object so rewrites keep keys we do not know about. */
interface AccountsFile {
	path: string;
	data: Record<string, unknown>;
	accounts: Record<string, string>;
	active?: string;
}

/** What `/ocgo-account` reports when called without an identity. */
export interface Status {
	/** Identity last activated through this extension; absent until the first activation. */
	active?: string;
	accounts: string[];
	/** `active` no longer names an identity in `accounts`. */
	known: boolean;
	/** `auth.json` does not currently hold the active identity's key value. */
	drift: boolean;
}

export interface Switch {
	identity: string;
	changed: boolean;
}

/** The directory pi keeps `auth.json` in; `ocgo.json` lives next to it. */
function agentDir(): string {
	const dir = process.env[AGENT_DIR_ENV]?.trim();
	if (!dir) return join(homedir(), ".pi", "agent");
	if (dir === "~") return homedir();
	return dir.startsWith("~/") ? join(homedir(), dir.slice(2)) : dir;
}

export function accountsPath(): string {
	return join(agentDir(), ACCOUNTS_FILE);
}

function authPath(): string {
	return join(agentDir(), AUTH_FILE);
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** `undefined` when the file does not exist, an error when it is not a JSON object. */
async function readJsonObject(path: string, label: string): Promise<Record<string, unknown> | undefined> {
	let text: string;
	try {
		text = await readFile(path, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw new Error(`Cannot read ${label}: ${describeError(error)}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`Invalid ${label}: ${describeError(error)}`);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`Invalid ${label}: expected a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

async function loadAccounts(): Promise<AccountsFile> {
	const path = accountsPath();
	const data = await readJsonObject(path, ACCOUNTS_FILE);
	if (!data) throw new Error(`No ${ACCOUNTS_FILE} at ${path}`);

	const raw = data.accounts;
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error(`Invalid ${ACCOUNTS_FILE}: "accounts" must be an object of identity to key`);
	}
	const accounts: Record<string, string> = {};
	for (const [identity, value] of Object.entries(raw)) {
		if (typeof value !== "string" || value.trim().length === 0) {
			throw new Error(`Invalid ${ACCOUNTS_FILE}: "${identity}" must map to a non-empty string`);
		}
		accounts[identity] = value;
	}
	if (Object.keys(accounts).length === 0) throw new Error(`Invalid ${ACCOUNTS_FILE}: "accounts" is empty`);
	if (data.active !== undefined && typeof data.active !== "string") {
		throw new Error(`Invalid ${ACCOUNTS_FILE}: "active" must be a string`);
	}

	return { path, data, accounts, ...(typeof data.active === "string" ? { active: data.active } : {}) };
}

/** The `key` `auth.json` currently stores for the provider, unresolved. */
function storedKey(auth: Record<string, unknown>): string | undefined {
	const credential = auth[PROVIDER];
	if (typeof credential !== "object" || credential === null || Array.isArray(credential)) return undefined;
	const key = (credential as Record<string, unknown>).key;
	return typeof key === "string" ? key : undefined;
}

/** Write through a sibling temp file so a crash cannot leave a half-written JSON file. */
async function writeJsonAtomically(path: string, data: unknown): Promise<void> {
	// A symlinked config (dotfiles repo, password store) must keep pointing at its target.
	const target = await realpath(path).catch(() => path);
	const temporary = `${target}.tmp-${process.pid}`;
	const existing = await stat(target).catch(() => undefined);
	const mode = existing ? existing.mode & 0o777 : CREATED_FILE_MODE;

	await mkdir(dirname(target), { recursive: true });
	try {
		await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf-8", mode });
		await chmod(temporary, mode);
		await rename(temporary, target);
	} catch (error) {
		await rm(temporary, { force: true }).catch(() => undefined);
		throw error;
	}
}

export async function status(): Promise<Status> {
	const file = await loadAccounts();
	const auth = (await readJsonObject(authPath(), AUTH_FILE)) ?? {};
	const active = file.active;
	return {
		accounts: Object.keys(file.accounts),
		...(active !== undefined ? { active } : {}),
		known: active !== undefined && active in file.accounts,
		drift: active !== undefined && active in file.accounts && storedKey(auth) !== file.accounts[active],
	};
}

/**
 * Point `opencode-go.key` at `accounts[identity]` and record the identity as active.
 * The key value is copied verbatim: a `!command` or `$ENV_VAR` stays a reference, so
 * no secret ever passes through this extension.
 */
export async function activate(identity: string): Promise<Switch> {
	const file = await loadAccounts();
	const key = file.accounts[identity];
	if (key === undefined) {
		throw new Error(`Unknown identity "${identity}". Available: ${Object.keys(file.accounts).join(", ")}`);
	}

	const auth = (await readJsonObject(authPath(), AUTH_FILE)) ?? {};
	const credential = auth[PROVIDER];
	const current =
		typeof credential === "object" && credential !== null && !Array.isArray(credential)
			? (credential as Record<string, unknown>)
			: undefined;
	if (credential !== undefined && !current) {
		throw new Error(`Invalid ${AUTH_FILE}: "${PROVIDER}" must be an object`);
	}
	if (current?.type !== undefined && current.type !== "api_key") {
		throw new Error(
			`${AUTH_FILE} holds a "${String(current.type)}" credential for ${PROVIDER}; refusing to overwrite it`,
		);
	}
	if (file.active === identity && storedKey(auth) === key) return { identity, changed: false };

	await writeJsonAtomically(authPath(), { ...auth, [PROVIDER]: { ...current, type: "api_key", key } });
	try {
		await writeJsonAtomically(file.path, { ...file.data, active: identity });
	} catch (error) {
		throw new Error(
			`Switched the ${PROVIDER} key to "${identity}", but could not update "active" in ${ACCOUNTS_FILE}: ` +
				describeError(error),
		);
	}
	return { identity, changed: true };
}

function describeStatus(state: Status): string {
	const accounts = `accounts: ${state.accounts.join(", ")}`;
	if (state.active === undefined) return `active: none · ${accounts}`;
	if (!state.known) return `active: ${state.active} (not in ${ACCOUNTS_FILE}) · ${accounts}`;
	if (state.drift) {
		const sync = `/ocgo-account ${state.active} to sync`;
		return `active: ${state.active} (${AUTH_FILE} differs — ${sync}) · ${accounts}`;
	}
	return `active: ${state.active} · ${accounts}`;
}

async function complete(prefix: string): Promise<AutocompleteItem[] | null> {
	const file = await loadAccounts().catch(() => undefined);
	if (!file) return null;
	const items = Object.keys(file.accounts)
		.filter((identity) => identity.startsWith(prefix))
		.map((identity) => ({
			value: identity,
			label: identity,
			...(identity === file.active ? { description: "active" } : {}),
		}));
	return items.length > 0 ? items : null;
}

async function handle(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const identity = args.trim();
	try {
		if (!identity) {
			ctx.ui.notify(describeStatus(await status()), "info");
			return;
		}
		const switched = await activate(identity);
		ctx.ui.notify(switched.changed ? `Switched to ${identity}` : `Already on ${identity}`, "info");
	} catch (error) {
		ctx.ui.notify(`ocgo-account: ${describeError(error)}`, "error");
	}
}

/** Registered only when `ocgo.json` exists; see `accountsPath()`. */
export function registerAccountCommand(pi: ExtensionAPI): void {
	pi.registerCommand("ocgo-account", {
		description: "Show or switch the active OpenCode Go account",
		getArgumentCompletions: complete,
		handler: handle,
	});
}
