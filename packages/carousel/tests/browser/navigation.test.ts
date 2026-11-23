import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import {
	call,
	click,
	type Engine,
	engines,
	launch,
	open,
	snapshot,
	startPositions,
} from "./harness.js";

describe.each(Object.keys(engines) as Engine[])("%s", (engine) => {
	let browser: Browser;
	beforeAll(async () => {
		browser = await launch(engine);
	});
	afterAll(() => browser.close());

	describe.each(["instant", "smooth"])("%s scrolling", (scrolling) => {
		const classes = scrolling === "smooth" ? "smooth" : "";

		test("next and prev move one page and stop at the ends", async () => {
			const { page, messages, close } = await open(browser, {
				slides: 4,
				classes,
			});
			expect(await snapshot(page)).toMatchObject({
				index: 0,
				count: 4,
				atStart: true,
				shown: 0,
			});
			expect(await page.getAttribute("#prev", "aria-disabled")).toBe("true");

			for (const index of [1, 2, 3]) {
				await click(page, "#next");
				expect(await snapshot(page)).toMatchObject({ index, shown: index });
			}
			expect(await snapshot(page)).toMatchObject({ atEnd: true, active: [3] });
			expect(await page.getAttribute("#next", "aria-disabled")).toBe("true");

			await click(page, "#next", true);
			expect((await snapshot(page)).index).toBe(3);
			await click(page, "#prev");
			expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
			expect(messages).toEqual([]);
			await close();
		});

		test("markers go to their page and mark the current one", async () => {
			const { page, close } = await open(browser, {
				slides: 5,
				classes,
				markers: true,
			});
			expect(await page.locator(".marker").count()).toBe(5);
			await click(page, ".marker >> nth=3");
			expect(await snapshot(page)).toMatchObject({ index: 3, shown: 3 });
			expect(await page.getAttribute(".marker >> nth=3", "aria-current")).toBe(
				"true",
			);
			await click(page, ".marker >> nth=1");
			expect(await snapshot(page)).toMatchObject({ index: 1, shown: 1 });
			await close();
		});

		test("several slides in view share the last page", async () => {
			const { page, close } = await open(browser, {
				slides: 10,
				classes,
				markers: true,
				style: "--gap: 10px; --w: calc((100% - 20px) / 3)",
			});
			expect((await snapshot(page)).count).toBe(8);
			expect(await page.locator(".marker").count()).toBe(8);
			await call(page, "goTo(7)");
			const state = await snapshot(page);
			expect(state).toMatchObject({ index: 7, atEnd: true });
			expect(state.scroll).toBe(state.max);
			await click(page, "#prev");
			expect((await snapshot(page)).index).toBe(6);
			await close();
		});

		test("slides of different widths snap where the browser does", async () => {
			const { page, close } = await open(browser, {
				slides: ["300px", "150px", "200px", "400px", "250px", "300px"],
				classes,
			});
			const positions = await startPositions(page);
			expect((await snapshot(page)).count).toBe(positions.length);
			for (const [index, position] of positions.entries()) {
				if (index === 0) continue;
				await click(page, "#next");
				const state = await snapshot(page);
				expect(state.index).toBe(index);
				expect(Math.abs(state.scroll - position)).toBeLessThanOrEqual(1);
			}
			await close();
		});

		test("rapid clicks move one page each", async () => {
			const { page, close } = await open(browser, { slides: 6, classes });
			await page.click("#next");
			await page.click("#next");
			await page.click("#next");
			await click(page, "#next");
			expect(await snapshot(page)).toMatchObject({ index: 4, shown: 4 });
			await close();
		});

		test("centred slides with scroll padding", async () => {
			const { page, close } = await open(browser, {
				slides: 5,
				classes,
				style: "--w: 70%; --gap: 10px; --align: center",
				css: ".track { scroll-padding-inline: 20px; }",
			});
			for (const index of [1, 2, 3]) {
				await click(page, "#next");
				expect(await snapshot(page)).toMatchObject({ index, shown: index });
			}
			await click(page, "#prev");
			expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
			await close();
		});

		test("right to left", async () => {
			const { page, close } = await open(browser, {
				slides: 4,
				classes,
				dir: "rtl",
			});
			await click(page, "#next");
			await click(page, "#next");
			expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
			await click(page, "#prev");
			expect(await snapshot(page)).toMatchObject({ index: 1, shown: 1 });
			await close();
		});

		test("vertical", async () => {
			const { page, close } = await open(browser, {
				slides: 4,
				classes: `${classes} vertical`,
			});
			await click(page, "#next");
			await click(page, "#next");
			const state = await snapshot(page);
			expect(state).toMatchObject({ index: 2, shown: 2 });
			expect(state.scroll).toBe(600);
			await close();
		});

		test("rewind goes round at the ends", async () => {
			const { page, close } = await open(browser, {
				slides: 3,
				classes,
				attributes: "data-carousel--rewind",
			});
			await click(page, "#prev");
			expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
			await click(page, "#next");
			expect(await snapshot(page)).toMatchObject({ index: 0, shown: 0 });
			await close();
		});
	});

	test("the status announces moves", async () => {
		const { page, close } = await open(browser, { slides: 4, status: true });
		expect(await page.textContent("#status")).toBe("");
		await click(page, "#next");
		expect(await page.textContent("#status")).toBe("Slide 2 of 4");
		await close();
	});

	test("slides out of view are inert", async () => {
		const { page, close } = await open(browser, {
			slides: 3,
			attributes: "data-carousel--inert",
		});
		const inert = () =>
			page.$$eval("#track > *", (slides) =>
				slides.map((slide) => slide.hasAttribute("inert")),
			);
		expect(await inert()).toEqual([false, true, true]);
		await click(page, "#next");
		expect(await inert()).toEqual([true, false, true]);
		await close();
	});

	test("scrolling the track by hand updates the state", async () => {
		const { page, close } = await open(browser, { slides: 4 });
		await page.evaluate(() => {
			document.getElementById("track")?.scrollTo({ left: 1210 });
		});
		await page.waitForTimeout(50);
		await click(page, "body");
		expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
		await close();
	});
});
