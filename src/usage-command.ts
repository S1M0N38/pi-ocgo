import { existsSync } from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { accountsPath, status } from "./account.ts";
import { formatPercent, formatReset, type Style } from "./format.ts";
import { fetchUsage, PROVIDER, type Usage } from "./usage.ts";

const ENTRY_TYPE = "ocgo-usage";

/** Label column, percent column, then a dim connective and an italic countdown. */
const WINDOWS: Array<{ label: string; key: keyof Usage; days: boolean }> = [
	{ label: "Rolling:", key: "rolling", days: false },
	{ label: "Weekly:", key: "weekly", days: true },
	{ label: "Monthly:", key: "monthly", days: true },
];

/** Identities from `ocgo.json`, read only when more than one is configured. */
interface Accounts {
	/** Identity last activated through `/ocgo-account`; absent before the first switch. */
	active?: string;
	identities: string[];
}

/**
 * What the entry carries: the usage snapshot, plus the identity snapshot in multi-account
 * setups. Entries written before `account` existed stay renderable, and the account is in
 * the entry so a reloaded session renders the same header without reading `ocgo.json` again.
 */
type EntryData = Usage & { account?: Accounts };

function render(data: EntryData, style: Style): string {
	const lines = [style.bold("OpenCode Go Usage"), ""];
	if (data.account) {
		lines.push(`${style.fg("dim", "Account:")} ${data.account.active ?? "none"}`, "");
	}
	lines.push(
		...WINDOWS.map(
			({ label, key, days }) =>
				`${style.fg("dim", label.padEnd(9))}${formatPercent(data[key]).padStart(4)}${style.fg(
					"dim",
					" used · resets in ",
				)}${style.italic(formatReset(data[key], days))}`,
		),
	);
	return lines.join("\n");
}

/**
 * Identities, but only when more than one is configured: with a single account there is
 * nothing to disambiguate, and no `ocgo.json` means `/ocgo-account` is not even registered.
 */
async function multiAccount(): Promise<Accounts | undefined> {
	if (!existsSync(accountsPath())) return undefined;
	try {
		const state = await status();
		if (state.accounts.length < 2) return undefined;
		return { ...(state.active !== undefined ? { active: state.active } : {}), identities: state.accounts };
	} catch {
		return undefined;
	}
}

export function registerUsageCommand(pi: ExtensionAPI): void {
	pi.registerEntryRenderer<EntryData>(ENTRY_TYPE, (entry, _options, theme) => {
		if (!entry.data) return new Text(theme.fg("error", "No OpenCode Go usage data"), 1, 0);
		return new Text(render(entry.data, theme), 1, 0);
	});

	pi.registerCommand("ocgo-usage", {
		description: "Show OpenCode Go usage (5-hour, weekly, monthly)",
		handler: async (_args, ctx) => show(pi, ctx),
	});
}

async function show(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const apiKey = (await ctx.modelRegistry.getProviderAuth(PROVIDER))?.auth.apiKey;
	if (!apiKey) {
		ctx.ui.notify(`No ${PROVIDER} API key. Run /login ${PROVIDER}.`, "error");
		return;
	}
	try {
		const [usage, account] = await Promise.all([fetchUsage(apiKey), multiAccount()]);
		pi.appendEntry<EntryData>(ENTRY_TYPE, { ...usage, ...(account ? { account } : {}) });
	} catch (error) {
		ctx.ui.notify(`ocgo-usage: ${error instanceof Error ? error.message : String(error)}`, "error");
	}
}
