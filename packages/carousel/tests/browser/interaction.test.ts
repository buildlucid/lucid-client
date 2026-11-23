import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import {
	click,
	drag,
	type Engine,
	engines,
	launch,
	open,
	settle,
	snapshot,
} from "./harness.js";

/** Mouse drag and autoplay */
describe.each(Object.keys(engines) as Engine[])("%s", (engine) => {
	let browser: Browser;
	beforeAll(async () => {
		browser = await launch(engine);
	});
	afterAll(() => browser.close());

	describe.each(["", "data-carousel--loop"])("drag %s", (loop) => {
		const attributes = `data-carousel--drag ${loop}`;

		test("a long drag moves to the next page, and a short one goes back", async () => {
			const { page, messages, close } = await open(browser, {
				slides: 5,
				attributes,
			});
			await drag(page, -400, { steps: 20, delay: 30 });
			expect(await snapshot(page)).toMatchObject({ index: 1, shown: 1 });
			await drag(page, -100, { steps: 20, delay: 45 });
			expect(await snapshot(page)).toMatchObject({ index: 1, shown: 1 });
			await drag(page, 400, { steps: 20, delay: 30 });
			expect(await snapshot(page)).toMatchObject({ index: 0, shown: 0 });
			expect(messages).toEqual([]);
			await close();
		});

		// A flick's speed depends on how quickly the browser sees the moves, which a busy machine slows down.
		test("a quick flick moves on a page", { retry: 2 }, async () => {
			const { page, close } = await open(browser, { slides: 5, attributes });
			await drag(page, -150, { steps: 3, delay: 0 });
			expect(await snapshot(page)).toMatchObject({ index: 1, shown: 1 });
			await close();
		});

		test("dragging keeps going round while looping", async () => {
			if (!loop) return;
			const { page, close } = await open(browser, { slides: 4, attributes });
			await drag(page, 400, { steps: 20, delay: 30 });
			expect(await snapshot(page)).toMatchObject({ index: 3, shown: 3 });
			await drag(page, -400, { steps: 20, delay: 30 });
			await drag(page, -400, { steps: 20, delay: 30 });
			expect(await snapshot(page)).toMatchObject({ index: 1, shown: 1 });
			await close();
		});

		test("links inside slides still work, but not at the end of a drag", async () => {
			const { page, close } = await open(browser, {
				slides: 4,
				attributes,
				content: (index) =>
					`<a href="#clicked-${index}" class="link" style="display:block;height:100%">Slide ${index}</a>`,
			});
			await drag(page, -400, { steps: 20, delay: 30 });
			expect(await page.evaluate(() => location.hash)).toBe("");
			await page.click(".link >> nth=1");
			expect(await page.evaluate(() => location.hash)).toBe("#clicked-1");
			await close();
		});
	});

	describe("autoplay", () => {
		const fixture = {
			slides: 4,
			attributes: 'data-carousel--autoplay="700"',
			extra: `<button data-carousel--action="toggle" id="toggle"></button><a href="#" id="inside">Inside</a>`,
		};

		test("moves on, pauses on hover and stops on focus", async () => {
			const { page, close } = await open(browser, fixture, {
				viewport: { width: 1200, height: 600 },
			});
			expect((await snapshot(page)).playing).toBe(true);
			expect(await page.getAttribute("#toggle", "aria-label")).toBe(
				"Stop automatic slide show",
			);
			await page.waitForTimeout(900);
			expect((await snapshot(page)).index).toBeGreaterThanOrEqual(1);

			await page.mouse.move(100, 50);
			await settle(page);
			const paused = (await snapshot(page)).index;
			await page.waitForTimeout(1000);
			expect((await snapshot(page)).index).toBe(paused);
			expect((await snapshot(page)).playing).toBe(true);
			await page.mouse.move(1100, 500);

			await page.focus("#inside");
			expect((await snapshot(page)).playing).toBe(false);
			expect(await page.getAttribute("#toggle", "aria-label")).toBe(
				"Start automatic slide show",
			);
			await close();
		});

		test("the toggle starts and stops it", async () => {
			const { page, close } = await open(browser, fixture, {
				viewport: { width: 1200, height: 600 },
			});
			await page.mouse.move(1100, 500);
			await click(page, "#toggle");
			expect((await snapshot(page)).playing).toBe(false);
			await page.mouse.move(1100, 500);
			await click(page, "#toggle");
			expect((await snapshot(page)).playing).toBe(true);
			await close();
		});

		test("doesn't start for visitors who prefer reduced motion", async () => {
			const { page, close } = await open(browser, fixture, {
				reducedMotion: "reduce",
			});
			expect((await snapshot(page)).playing).toBe(false);
			await page.waitForTimeout(900);
			expect((await snapshot(page)).index).toBe(0);
			await close();
		});
	});
});
