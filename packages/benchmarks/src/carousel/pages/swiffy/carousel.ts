import { swiffyslider } from "swiffy-slider";
import "swiffy-slider/css";
import {
	app,
	type CarouselOptions,
	carouselLabel,
	range,
	slideText,
} from "../../data.ts";

/** Swiffy Slider's markup from its README, with an indicator for each slide. */
export const carouselMarkup = ({ index, slides, dots }: CarouselOptions) => `
	<section class="swiffy-slider" data-bench-carousel aria-label="${carouselLabel(index)}">
		<ul class="slider-container" data-bench-viewport>
			${range(slides)
				.map((slide) => `<li data-bench-slide>${slideText(index, slide)}</li>`)
				.join("")}
		</ul>
		<button type="button" class="slider-nav" data-bench-prev aria-label="Previous slide"></button>
		<button type="button" class="slider-nav slider-nav-next" data-bench-next aria-label="Next slide"></button>
		${
			dots
				? `<div class="slider-indicators">${range(slides)
						.map(
							(slide) =>
								`<button${slide === 0 ? ' class="active"' : ""} aria-label="Go to slide ${slide + 1}"></button>`,
						)
						.join("")}</div>`
				: ""
		}
	</section>
`;

/** Starts every slider on the page. */
export const start = () => swiffyslider.init(app());

/** Clicks one of the first slider's indicators. */
export const clickDot = (index: number) => {
	app()
		.querySelectorAll<HTMLElement>(".slider-indicators > button")
		[index]?.click();
};
