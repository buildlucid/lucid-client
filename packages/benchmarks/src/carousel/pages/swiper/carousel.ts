import Swiper from "swiper";
import { A11y, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/a11y";
import "swiper/css/pagination";
import {
	app,
	type CarouselOptions,
	carouselLabel,
	range,
	slideText,
} from "../../data.ts";

/**
 * Swiper's markup, with its own buttons, which the Navigation module wires up.
 * The Pagination module renders the dots into `.swiper-pagination`.
 */
export const carouselMarkup = ({ index, slides, dots }: CarouselOptions) => `
	<section class="swiper" data-bench-carousel data-bench-viewport aria-label="${carouselLabel(index)}">
		<div class="swiper-wrapper">
			${range(slides)
				.map(
					(slide) =>
						`<div class="swiper-slide" data-bench-slide>${slideText(index, slide)}</div>`,
				)
				.join("")}
		</div>
		<button class="swiper-prev" type="button" data-bench-prev>‹</button>
		<button class="swiper-next" type="button" data-bench-next>›</button>
		${dots ? `<div class="swiper-pagination"></div>` : ""}
	</section>
`;

/**
 * Starts every carousel on the page with the Navigation, Pagination and A11y
 * modules. `cssMode` scrolls the slides with CSS scroll snapping instead of
 * moving them with transforms.
 */
export const start = (cssMode = false) => {
	for (const element of app().querySelectorAll<HTMLElement>(".swiper")) {
		const pagination = element.querySelector<HTMLElement>(".swiper-pagination");
		new Swiper(element, {
			modules: [A11y, Navigation, Pagination],
			cssMode,
			speed: 300,
			navigation: {
				prevEl: element.querySelector<HTMLElement>(".swiper-prev"),
				nextEl: element.querySelector<HTMLElement>(".swiper-next"),
			},
			pagination: pagination ? { el: pagination, clickable: true } : false,
		});
	}
};

/** Clicks one of the first carousel's dots. */
export const clickDot = (index: number) => {
	app()
		.querySelectorAll<HTMLElement>(".swiper-pagination-bullet")
		[index]?.click();
};
