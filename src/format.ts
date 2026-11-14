import type { Usage, UsageWindow } from "./usage.ts";

/** The subset of the Pi theme the renderer uses. */
export interface Style {
	fg(color: "dim", text: string): string;
	bold(text: string): string;
	italic(text: string): string;
}

/** Percentage of a window used, e.g. `3%`. */
export function formatPercent(window: UsageWindow): string {
	return `${window.percent}%`;
}

/**
 * `2h 5m` for the rolling window, `1d 05h` for the weekly and monthly windows.
 * Entries written before windows stored `resetsAt` render as `0h 0m`.
 */
export function formatReset(window: UsageWindow, withDays: boolean, now = Date.now()): string {
	const seconds = Number.isFinite(window.resetsAt) ? Math.max(0, Math.round((window.resetsAt - now) / 1000)) : 0;
	const days = Math.floor(seconds / 86_400);
	const hours = Math.floor((seconds % 86_400) / 3_600);
	const minutes = Math.floor((seconds % 3_600) / 60);
	return withDays ? `${days}d ${String(hours).padStart(2, "0")}h` : `${hours}h ${minutes}m`;
}
