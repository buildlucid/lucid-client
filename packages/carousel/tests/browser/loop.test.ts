import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import {
	call,
	click,
	type Engine,
	engines,
	type Fixture,
	launch,
	open,
	snapshot,
} from "./harness.js";

/**
 * Looping reorders slides with CSS `order`, so these check what's on screen
 * against the DOM index the carousel reports, all the way round in both
 * directions.
 */
describe.each(Object.keys(engines) as Engine[])("%s", (engine) => {
	let browser: Browser;
	beforeAll(async () => {
		browser = await launch(engine);
	});
	afterAll(() => browser.close());

	const loops: Array<[string, Fixture, number]> = [
		["one slide in view", { slides: 5 }, 5],
		["two of four in view", { slides: 4, style: "--w: 50%" }, 4],
		["two of three in view", { slides: 3, style: "--w: 50%" }, 3],
		[
			"three of five in view with a gap",
			{ slides: 5, style: "--w: calc((100% - 20px) / 3); --gap: 10px" },
			5,
		],
		[
			"centred slides",
			{ slides: 5, style: "--w: 60%; --gap: 10px; --align: center" },
			5,
		],
		[
			"slides of different widths",
			{ slides: ["300px", "150px", "400px", "250px", "200px", "350px"] },
			6,
		],
		["right to left", { slides: 4, dir: "rtl" }, 4],
		["vertical", { slides: 4, classes: "vertical" }, 4],
	];

	describe.each(["instant", "smooth"])("%s scrolling", (scrolling) => {
		describe.each(loops)("%s", (_, fixture, pages) => {
			const classes = [fixture.classes, scrolling === "smooth" ? "smooth" : ""]
				.filter(Boolean)
				.join(" ");
			const loopFixture: Fixture = {
				...fixture,
				classes,
				attributes: "data-carousel--loop",
			};

			test("goes round forwards and backwards", async () => {
				const { page, messages, close } = await open(browser, loopFixture);
				const start = await snapshot(page);
				expect(start).toMatchObject({
					index: 0,
					count: pages,
					shown: 0,
					atStart: false,
					atEnd: false,
				});
				expect(await page.getAttribute("#prev", "aria-disabled")).toBeNull();

				for (let step = 1; step <= pages + 2; step++) {
					await click(page, "#next");
					const state = await snapshot(page);
					expect(state.index, `next ${step}`).toBe(step % pages);
					expect(state.shown, `next ${step}`).toBe(step % pages);
				}
				for (let step = 1; step <= pages + 2; step++) {
					await click(page, "#prev");
					const expected = (((pages + 2 - step) % pages) + pages) % pages;
					const state = await snapshot(page);
					expect(state.index, `prev ${step}`).toBe(expected);
					expect(state.shown, `prev ${step}`).toBe(expected);
				}

				// Slides are never cloned.
				expect((await snapshot(page)).slides).toBe(
					typeof fixture.slides === "number"
						? fixture.slides
						: fixture.slides.length,
				);
				expect(messages).toEqual([]);
				await close();
			});

			test("goes straight to any page", async () => {
				const { page, close } = await open(browser, loopFixture);
				for (const target of [pages - 1, 1, pages - 2, 0]) {
					await call(page, `goTo(${target})`);
					expect(await snapshot(page)).toMatchObject({
						index: target,
						shown: target,
					});
				}
				await close();
			});
		});
	});

	test("prev from the first slide goes to the last", async () => {
		const { page, close } = await open(browser, {
			slides: 5,
			attributes: "data-carousel--loop",
		});
		await click(page, "#prev");
		expect(await snapshot(page)).toMatchObject({ index: 4, shown: 4 });
		await close();
	});

	test("rapid clicks keep going round", async () => {
		const { page, close } = await open(browser, {
			slides: 4,
			classes: "smooth",
			attributes: "data-carousel--loop",
		});
		for (let i = 0; i < 5; i++) await page.click("#next");
		await click(page, "#next");
		expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
		await close();
	});

	test("rewinds instead when the slides can't loop, and says so", async () => {
		const { page, messages, close } = await open(browser, {
			slides: 2,
			attributes: "data-carousel--loop",
		});
		await click(page, "#next");
		await click(page, "#next");
		expect(await snapshot(page)).toMatchObject({ index: 0, shown: 0 });
		expect(messages.some((message) => message.includes("Looping needs"))).toBe(
			true,
		);
		await close();
	});
});
