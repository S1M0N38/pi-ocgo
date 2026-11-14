import type { Usage, UsageWindow } from "./usage.ts";

const LABEL_WIDTH = 15;

/** `1h 5m` for the rolling window, `4d 09h` for the weekly and monthly windows. */
export function formatReset(window: UsageWindow, withDays: boolean): string {
	const days = Math.floor(window.resetInSec / 86_400);
	const hours = Math.floor((window.resetInSec % 86_400) / 3_600);
	const minutes = Math.floor((window.resetInSec % 3_600) / 60);
	return withDays ? `${days}d ${String(hours).padStart(2, "0")}h` : `${hours}h ${minutes}m`;
}

/** One dim-labelled row with an italic reset countdown. */
export function formatRow(label: string, window: UsageWindow, withDays: boolean, style: Style): string {
	const percent = `${window.percent}%`.padStart(4);
	return `${style.fg("dim", label.padEnd(LABEL_WIDTH))}${percent} used ${style.italic(`Resets in ${formatReset(window, withDays)}`)}`;
}

export interface Style {
	fg(color: "dim", text: string): string;
	italic(text: string): string;
}

const ROWS: Array<[string, keyof Usage, boolean]> = [
	["5-hour window:", "rolling", false],
	["Weekly:", "weekly", true],
	["Monthly:", "monthly", true],
];

export function formatUsage(usage: Usage, style: Style): string {
	return ROWS.map(([label, key, withDays]) => formatRow(label, usage[key], withDays, style)).join("\n");
}
