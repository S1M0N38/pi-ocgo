import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { formatPercent, formatReset, type Style } from "./format.ts";
import { fetchUsage, PROVIDER, type Usage } from "./usage.ts";

const ENTRY_TYPE = "ocgo-usage";

/** Label column, percent column, then a dim connective and an italic countdown. */
const WINDOWS: Array<{ label: string; key: keyof Usage; days: boolean }> = [
	{ label: "Rolling:", key: "rolling", days: false },
	{ label: "Weekly:", key: "weekly", days: true },
	{ label: "Monthly:", key: "monthly", days: true },
];

function render(usage: Usage, style: Style): string {
	return [
		style.bold("OpenCode Go Usage"),
		...WINDOWS.map(
			({ label, key, days }) =>
				`${style.fg("dim", label.padEnd(9))}${formatPercent(usage[key]).padStart(4)}${style.fg(
					"dim",
					" used · resets in ",
				)}${style.italic(formatReset(usage[key], days))}`,
		),
	].join("\n");
}

export default function registerOcgoUsage(pi: ExtensionAPI): void {
	pi.registerEntryRenderer<Usage>(ENTRY_TYPE, (entry, _options, theme) => {
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
		pi.appendEntry<Usage>(ENTRY_TYPE, await fetchUsage(apiKey));
	} catch (error) {
		ctx.ui.notify(`ocgo-usage: ${error instanceof Error ? error.message : String(error)}`, "error");
	}
}
