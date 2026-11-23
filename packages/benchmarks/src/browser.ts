import { Worker } from "node:worker_threads";
import { type Browser, chromium } from "playwright";

/**
 * Keeps one CPU core busy until the returned function is called. While a page
 * is mostly idle, as it is while a carousel scrolls, the OS slows the CPU down
 * or moves the page's thread to an efficiency core, so work spread over many
 * frames measures several times slower than the same work done at once. A busy
 * core keeps the CPU at full speed, so every library is measured at the same
 * speed however it spreads its work.
 */
export const keepCpuBusy = () => {
	const worker = new Worker("for (;;) {}", { eval: true });
	return () => worker.terminate();
};

/** Chromium in its new headless mode, with `gc()` exposed so samples can start from a clean heap. */
export const launch = () =>
	chromium.launch({
		channel: "chromium",
		args: ["--js-flags=--expose-gc"],
	});

/**
 * Opens a page in a fresh browser context, so no sample shares a renderer,
 * cache or heap with another. Errors and warnings the page logs are collected
 * for the output check. `throttle` slows the CPU down by that factor.
 */
export const open = async (browser: Browser, url: string, throttle: number) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	const messages: string[] = [];
	page.on("pageerror", (error) => messages.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error" || message.type() === "warning") {
			messages.push(message.text());
		}
	});
	if (throttle > 1) {
		await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
	}
	await cdp.send("Performance.enable");
	const response = await page.goto(url, { waitUntil: "load" });
	if (!response?.ok()) throw new Error(`Couldn't load ${url}`);

	return {
		page,
		messages,
		/**
		 * How long the page has spent running scripts, recalculating styles and
		 * laying out since it opened, in ms. Painting isn't counted, because how
		 * much of it runs on the main thread depends on the GPU, and headless
		 * Chromium has none.
		 */
		busy: async () => {
			const { metrics } = await cdp.send("Performance.getMetrics");
			const value = (name: string) =>
				metrics.find((metric) => metric.name === name)?.value ?? 0;
			return (
				(value("ScriptDuration") +
					value("RecalcStyleDuration") +
					value("LayoutDuration")) *
				1000
			);
		},
		/** The live JS heap after a full garbage collection, in bytes. */
		heap: async () => {
			await cdp.send("HeapProfiler.collectGarbage");
			const { usedSize } = await cdp.send("Runtime.getHeapUsage");
			return usedSize;
		},
		close: () => context.close(),
	};
};

export type Session = Awaited<ReturnType<typeof open>>;
