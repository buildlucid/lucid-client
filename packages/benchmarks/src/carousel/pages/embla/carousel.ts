import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import {
	app,
	type CarouselOptions,
	carouselLabel,
	range,
	slideText,
} from "../../data.ts";
import "./embla.css";

/** Embla's markup: a viewport around a container of slides, with buttons and dots beside it. */
export const carouselMarkup = ({ index, slides, dots }: CarouselOptions) => `
	<section class="embla" data-bench-carousel aria-label="${carouselLabel(index)}">
		<div class="embla__viewport" data-bench-viewport>
			<div class="embla__container">
				${range(slides)
					.map(
						(slide) =>
							`<div class="embla__slide" data-bench-slide>${slideText(index, slide)}</div>`,
					)
					.join("")}
			</div>
		</div>
		<button class="embla__prev" type="button" data-bench-prev aria-label="Previous slide">‹</button>
		<button class="embla__next" type="button" data-bench-next aria-label="Next slide">›</button>
		${dots ? `<div class="embla__dots"></div>` : ""}
	</section>
`;

/**
 * Previous and next buttons that disable at the ends, as Embla's
 * `addPrevNextBtnsClickHandlers` example does.
 */
const addArrows = (
	api: EmblaCarouselType,
	prev: HTMLButtonElement,
	next: HTMLButtonElement,
) => {
	const toggle = () => {
		prev.disabled = !api.canScrollPrev();
		next.disabled = !api.canScrollNext();
	};
	prev.addEventListener("click", () => api.scrollPrev());
	next.addEventListener("click", () => api.scrollNext());
	toggle();
	api.on("select", toggle).on("reInit", toggle);
};

/** A dot for each snap, as Embla's `addDotBtnsAndClickHandlers` example does. */
const addDots = (api: EmblaCarouselType, container: HTMLElement) => {
	let dots: HTMLElement[] = [];
	const render = () => {
		container.innerHTML = api
			.scrollSnapList()
			.map(() => `<button class="embla__dot" type="button"></button>`)
			.join("");
		dots = Array.from(container.querySelectorAll<HTMLElement>(".embla__dot"));
		dots.forEach((dot, index) => {
			dot.addEventListener("click", () => api.scrollTo(index));
		});
	};
	const select = () => {
		dots[api.previousScrollSnap()]?.classList.remove("embla__dot--selected");
		dots[api.selectedScrollSnap()]?.classList.add("embla__dot--selected");
	};
	render();
	select();
	api.on("reInit", render).on("reInit", select).on("select", select);
};

/** Starts every carousel on the page. */
export const start = () => {
	for (const root of app().querySelectorAll<HTMLElement>(".embla")) {
		const api = EmblaCarousel(
			root.querySelector<HTMLElement>(".embla__viewport")!,
		);
		addArrows(
			api,
			root.querySelector<HTMLButtonElement>(".embla__prev")!,
			root.querySelector<HTMLButtonElement>(".embla__next")!,
		);
		const dots = root.querySelector<HTMLElement>(".embla__dots");
		if (dots) addDots(api, dots);
	}
};

/** Clicks one of the first carousel's dots. */
export const clickDot = (index: number) => {
	app().querySelectorAll<HTMLElement>(".embla__dot")[index]?.click();
};
