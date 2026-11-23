import { type Browser, chromium } from "playwright";

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
	const response = await page.goto(url, { waitUntil: "load" });
	if (!response?.ok()) throw new Error(`Couldn't load ${url}`);

	return {
		page,
		messages,
		/** The live JS heap after a full garbage collection, in bytes. */
		heap: async () => {
			await cdp.send("HeapProfiler.collectGarbage");
			const { usedSize } = await cdp.send("Runtime.getHeapUsage");
			return usedSize;
		},
		close: () => context.close(),
	};
};
