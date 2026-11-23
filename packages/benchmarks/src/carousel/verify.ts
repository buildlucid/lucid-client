import type { Page } from "playwright";
import type { Scenario } from "../suite.ts";

/** The slide each listed carousel should show once the scenario has run. */
export type ExpectedSlides = Array<{ carousel: number; slide: number }>;

/**
 * Runs in the page, so it can't use anything from this module. Returns the
 * slide each carousel shows: the one that covers most of the element that
 * clips or scrolls its slides. Works whether a library moves its slides with
 * transforms or scrolls them.
 */
const slidesInView = () =>
	Array.from(document.querySelectorAll("[data-bench-carousel]"), (carousel) => {
		const viewport =
			carousel.querySelector("[data-bench-viewport]") ??
			(carousel.hasAttribute("data-bench-viewport") ? carousel : null);
		if (!viewport) return -1;
		const view = viewport.getBoundingClientRect();
		let best = -1;
		let bestOverlap = 0;
		carousel.querySelectorAll("[data-bench-slide]").forEach((slide, index) => {
			const box = slide.getBoundingClientRect();
			const overlap =
				Math.min(box.right, view.right) - Math.max(box.left, view.left);
			if (overlap > bestOverlap + 0.5) {
				best = index;
				bestOverlap = overlap;
			}
		});
		return best;
	});

/**
 * Checks each carousel shows the slide the scenario expects. Animations and
 * smooth scrolling take time, so it waits until the slides stop moving.
 */
export const verifySlides = async (page: Page, scenario: Scenario) => {
	const expected = (scenario.expected ?? []) as ExpectedSlides;
	if (expected.length === 0) return null;

	let previous = "";
	let shown: number[] = [];
	for (let attempt = 0; attempt < 40; attempt++) {
		shown = await page.evaluate(slidesInView);
		const current = await page.evaluate(() =>
			Array.from(
				document.querySelectorAll("[data-bench-slide]"),
				(slide) => slide.getBoundingClientRect().left,
			).join(),
		);
		if (current === previous) break;
		previous = current;
		await page.waitForTimeout(100);
	}

	const wrong = expected.filter(
		({ carousel, slide }) => shown[carousel] !== slide,
	);
	if (wrong.length === 0) return null;
	return wrong
		.map(
			({ carousel, slide }) =>
				`carousel ${carousel + 1} ends on slide ${(shown[carousel] ?? -1) + 1}, not slide ${slide + 1}`,
		)
		.join("; ");
};
