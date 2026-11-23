import { Blossom } from "@blossom-carousel/core";
import "@blossom-carousel/core/style.css";
import {
	app,
	type CarouselOptions,
	carouselLabel,
	range,
	slideText,
} from "../../data.ts";
import "./blossom.css";

/** A scroller of slides, which Blossom enhances, with buttons and dots beside it. */
export const carouselMarkup = ({ index, slides, dots }: CarouselOptions) => `
	<section class="blossom" data-bench-carousel aria-label="${carouselLabel(index)}">
		<div class="blossom-scroller" data-bench-viewport>
			${range(slides)
				.map(
					(slide) =>
						`<div class="blossom-slide" data-bench-slide>${slideText(index, slide)}</div>`,
				)
				.join("")}
		</div>
		<button class="blossom-prev" type="button" data-bench-prev aria-label="Previous slide">‹</button>
		<button class="blossom-next" type="button" data-bench-next aria-label="Next slide">›</button>
		${
			dots
				? `<div class="blossom-dots">${range(slides)
						.map(
							(slide) =>
								`<button type="button" aria-label="Go to slide ${slide + 1}"></button>`,
						)
						.join("")}</div>`
				: ""
		}
	</section>
`;

/**
 * Dots for a native scroller. Blossom has no pagination or "go to" method, so
 * each dot scrolls to its slide, and the current dot follows the scroll
 * position, as a page using Blossom would write them.
 */
const addDots = (scroller: HTMLElement, container: HTMLElement) => {
	const dots = Array.from(container.querySelectorAll<HTMLElement>("button"));
	const slides = Array.from(scroller.children) as HTMLElement[];
	dots.forEach((dot, index) => {
		dot.addEventListener("click", () => {
			scroller.scrollTo({ left: slides[index]?.offsetLeft ?? 0 });
		});
	});
	let frame = 0;
	const select = () => {
		frame = 0;
		const current = Math.round(scroller.scrollLeft / scroller.clientWidth);
		dots.forEach((dot, index) => {
			dot.toggleAttribute("aria-current", index === current);
		});
	};
	scroller.addEventListener(
		"scroll",
		() => {
			if (!frame) frame = requestAnimationFrame(select);
		},
		{ passive: true },
	);
	select();
};

/** Starts every carousel on the page. */
export const start = () => {
	for (const root of app().querySelectorAll<HTMLElement>(".blossom")) {
		const scroller = root.querySelector<HTMLElement>(".blossom-scroller")!;
		const blossom = Blossom(scroller);
		blossom.init();
		root
			.querySelector(".blossom-prev")
			?.addEventListener("click", () => blossom.prev());
		root
			.querySelector(".blossom-next")
			?.addEventListener("click", () => blossom.next());
		const dots = root.querySelector<HTMLElement>(".blossom-dots");
		if (dots) addDots(scroller, dots);
	}
};

/** Clicks one of the first carousel's dots. */
export const clickDot = (index: number) => {
	app().querySelectorAll<HTMLElement>(".blossom-dots > button")[index]?.click();
};
