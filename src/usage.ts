export const PROVIDER = "opencode-go";
export const USAGE_URL = "https://opencode.ai/zen/go/v1/usage";

/** One usage window as returned by the OpenCode Go usage endpoint. */
export interface UsageWindow {
	/** Percentage of the window used, 0-100. */
	percent: number;
	/** Seconds until the window resets. */
	resetInSec: number;
}

export interface Usage {
	rolling: UsageWindow;
	weekly: UsageWindow;
	monthly: UsageWindow;
}

type RawWindow = Record<string, unknown> | undefined;

/**
 * The usage endpoint is undocumented (anomalyco/opencode#16513), so accept every
 * shape seen so far: `usage.rolling`, `rollingUsage`, `resetsAt` as an ISO string
 * or epoch milliseconds, and `resetInSec`.
 */
function toWindow(raw: RawWindow, now: number): UsageWindow {
	const percent = number(raw?.percent) ?? number(raw?.usagePercent) ?? 0;
	const resetsAt = typeof raw?.resetsAt === "string" ? Date.parse(raw.resetsAt) : number(raw?.resetsAt);
	const resetInSec = number(raw?.resetInSec) ?? (resetsAt === undefined ? 0 : (resetsAt - now) / 1000);
	return {
		percent: Math.min(100, Math.max(0, Math.round(percent))),
		resetInSec: Math.max(0, Math.round(resetInSec)),
	};
}

function number(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function fetchUsage(apiKey: string): Promise<Usage> {
	const response = await fetch(USAGE_URL, {
		headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
		throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
	}

	const body = (await response.json()) as Record<string, Record<string, RawWindow> | RawWindow> & {
		usage?: Record<string, RawWindow>;
	};
	const usage = (body.usage ?? body) as Record<string, RawWindow>;
	const now = Date.now();
	return {
		rolling: toWindow(usage.rolling ?? body.rollingUsage, now),
		weekly: toWindow(usage.weekly ?? body.weeklyUsage, now),
		monthly: toWindow(usage.monthly ?? body.monthlyUsage, now),
	};
}
