import carousel from "@lucidclient/carousel";
import {
	app,
	type CarouselOptions,
	carouselLabel,
	range,
	slideText,
} from "../../data.ts";
import "./carousel.css";

/** The markup the Lucid Carousel README shows: a list of slides, and a `<template>` for its dots. */
export const carouselMarkup = ({ index, slides, dots }: CarouselOptions) => `
	<section class="carousel" data-carousel data-bench-carousel aria-label="${carouselLabel(index)}">
		<ul class="carousel-track" data-carousel--track data-bench-viewport>
			${range(slides)
				.map((slide) => `<li data-bench-slide>${slideText(index, slide)}</li>`)
				.join("")}
		</ul>
		<button data-carousel--action="prev" data-bench-prev aria-label="Previous slide">‹</button>
		<button data-carousel--action="next" data-bench-next aria-label="Next slide">›</button>
		${dots ? `<div class="carousel-dots" data-carousel--markers><template><button class="carousel-dot"></button></template></div>` : ""}
	</section>
`;

/** Enhances every carousel on the page. */
export const start = () => carousel.init();

/** Clicks one of the first carousel's dots. */
export const clickDot = (index: number) => {
	app().querySelectorAll<HTMLElement>(".carousel-dot")[index]?.click();
};
