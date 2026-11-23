import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import {
	call,
	click,
	type Engine,
	engines,
	launch,
	open,
	settle,
	snapshot,
} from "./harness.js";

/** Resizes and markup changes after the carousel starts */
describe.each(Object.keys(engines) as Engine[])("%s", (engine) => {
	let browser: Browser;
	beforeAll(async () => {
		browser = await launch(engine);
	});
	afterAll(() => browser.close());

	const setWidth = async (
		page: import("playwright").Page,
		property: string,
		value: string,
	) => {
		await page.evaluate(
			([property, value]) =>
				document.getElementById("carousel")?.style.setProperty(property, value),
			[property, value] as const,
		);
		await settle(page);
	};

	describe.each(["", "data-carousel--loop"])("%s", (attributes) => {
		test("keeps the slide in view when the carousel resizes", async () => {
			const { page, close } = await open(browser, { slides: 5, attributes });
			await call(page, "goTo(3)");
			await setWidth(page, "--carousel-width", "420px");
			expect(await snapshot(page)).toMatchObject({ index: 3, shown: 3 });
			await setWidth(page, "--carousel-width", "700px");
			expect(await snapshot(page)).toMatchObject({ index: 3, shown: 3 });
			await close();
		});

		test("follows the pages when fewer slides fit", async () => {
			const { page, close } = await open(browser, {
				slides: 9,
				attributes,
				markers: true,
				style: "--w: calc(100% / 3)",
			});
			await call(page, "goTo(4)");
			expect(await snapshot(page)).toMatchObject({ index: 4, shown: 4 });
			await setWidth(page, "--w", "100%");
			expect(await snapshot(page)).toMatchObject({
				index: 4,
				count: 9,
				shown: 4,
			});
			expect(await page.locator(".marker").count()).toBe(9);
			await close();
		});

		test("keeps heading for its slide when a resize lands mid-scroll", async () => {
			const { page, close } = await open(browser, {
				slides: 5,
				attributes,
				classes: "smooth",
			});
			await page.click("#next");
			await page.click("#next");
			await page.waitForTimeout(60);
			await setWidth(page, "--carousel-width", "450px");
			expect(await snapshot(page)).toMatchObject({ index: 2, shown: 2 });
			await close();
		});

		test("keeps the slide in view when slides are added or removed", async () => {
			const { page, close } = await open(browser, { slides: 5, attributes });
			await call(page, "goTo(2)");
			await page.evaluate(() => {
				const slide = document.createElement("li");
				slide.textContent = "new";
				document.getElementById("track")?.prepend(slide);
			});
			await settle(page);
			let state = await snapshot(page);
			expect(state).toMatchObject({ index: 3, shown: 3, count: 6 });
			expect(
				await page.evaluate(() =>
					document
						.getElementById("slide-2")
						?.hasAttribute("data-carousel--active"),
				),
			).toBe(true);

			await page.evaluate(() => document.getElementById("slide-4")?.remove());
			await settle(page);
			state = await snapshot(page);
			expect(state).toMatchObject({ index: 3, shown: 3, count: 5 });

			await click(page, "#next");
			expect((await snapshot(page)).index).toBe(4);
			await close();
		});
	});

	test("focus stays on a marker when the markers are rebuilt", async () => {
		const { page, close } = await open(browser, {
			slides: 9,
			markers: true,
			style: "--w: calc(100% / 3)",
		});
		await page.focus(".marker >> nth=2");
		await page.keyboard.press("Enter");
		await settle(page);
		await setWidth(page, "--w", "100%");
		expect(await page.locator(".marker").count()).toBe(9);
		expect(
			await page.evaluate(() =>
				document.activeElement?.classList.contains("marker")
					? document.activeElement.textContent
					: null,
			),
		).toBe("3");
		await close();
	});

	test("destroy puts the markup back", async () => {
		const { page, close } = await open(browser, {
			slides: 4,
			markers: true,
			status: true,
			attributes: "data-carousel--loop",
			init: false,
		});
		const before = await page.evaluate(
			() => document.getElementById("carousel")?.outerHTML,
		);
		await page.evaluate(() =>
			(
				window as unknown as { Lucid: { carousel: { init: () => void } } }
			).Lucid.carousel.init(),
		);
		await settle(page);
		await click(page, "#next");
		await page.evaluate(() =>
			(
				window as unknown as { Lucid: { carousel: { destroy: () => void } } }
			).Lucid.carousel.destroy(),
		);
		expect(
			await page.evaluate(() => document.getElementById("carousel")?.outerHTML),
		).toBe(before);
		await close();
	});
});
