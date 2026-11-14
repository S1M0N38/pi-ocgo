import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { accountsPath, registerAccountCommand } from "./account.ts";
import { registerUsageCommand } from "./usage-command.ts";

export default function registerOcgo(pi: ExtensionAPI): void {
	registerUsageCommand(pi);
	if (existsSync(accountsPath())) registerAccountCommand(pi);
}
