import type { EntryRenderer, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { formatUsage } from "./format.ts";
import { fetchUsage, PROVIDER, type Usage } from "./usage.ts";

const ENTRY_TYPE = "ocgo-usage";

type Theme = Parameters<EntryRenderer>[2];

export default function registerOcgoUsage(pi: ExtensionAPI): void {
	pi.registerEntryRenderer<Usage>(ENTRY_TYPE, (entry, _options, theme) => {
		if (!entry.data) return new Text(theme.fg("error", "No OpenCode Go usage data"), 1, 0);
		return new Text(formatUsage(entry.data, theme), 1, 0);
	});

	pi.registerCommand("ocgo-usage", {
		description: "Show OpenCode Go usage (5-hour, weekly, monthly)",
		handler: async (_args, ctx) => {
			const apiKey = (await ctx.modelRegistry.getProviderAuth(PROVIDER))?.auth.apiKey;
			if (!apiKey) {
				ctx.ui.notify(`No ${PROVIDER} API key. Run /login ${PROVIDER}.`, "error");
				return;
			}
			try {
				pi.appendEntry<Usage>(ENTRY_TYPE, await fetchUsage(apiKey));
			} catch (error) {
				ctx.ui.notify(`ocgo-usage: ${errorMessage(error)}`, "error");
			}
		},
	});
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
