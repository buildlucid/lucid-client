import { Splide } from "@splidejs/splide";
import "@splidejs/splide/css/core";
import {
	app,
	type CarouselOptions,
	carouselLabel,
	range,
	slideText,
} from "../../data.ts";

/**
 * Splide's markup, with its arrows written in the markup as its docs show for
 * custom arrows. Splide renders the pagination itself.
 */
export const carouselMarkup = ({ index, slides, dots }: CarouselOptions) => `
	<section class="splide" data-bench-carousel data-dots="${dots}" aria-label="${carouselLabel(index)}">
		<div class="splide__arrows">
			<button class="splide__arrow splide__arrow--prev" data-bench-prev>‹</button>
			<button class="splide__arrow splide__arrow--next" data-bench-next>›</button>
		</div>
		<div class="splide__track" data-bench-viewport>
			<ul class="splide__list">
				${range(slides)
					.map(
						(slide) =>
							`<li class="splide__slide" data-bench-slide>${slideText(index, slide)}</li>`,
					)
					.join("")}
			</ul>
		</div>
	</section>
`;

/** Mounts every carousel on the page, moving at the same speed as Swiper. */
export const start = () => {
	for (const element of app().querySelectorAll<HTMLElement>(".splide")) {
		new Splide(element, {
			speed: 300,
			pagination: element.dataset.dots === "true",
		}).mount();
	}
};

/** Clicks one of the first carousel's dots. */
export const clickDot = (index: number) => {
	app()
		.querySelectorAll<HTMLElement>(".splide__pagination__page")
		[index]?.click();
};
