/** Carousels on the start-up page. */
export const CAROUSELS = 20;
/** Slides in each carousel, other than the large one. */
export const SLIDES = 10;
/** Slides in the large carousel. */
export const LARGE_SLIDES = 300;

/**
 * What every page renders for one carousel. Each library wraps it in its own
 * markup, and marks the parts the output check reads with `data-bench-*`
 * attributes: the carousel, the element that clips or scrolls its slides,
 * each slide, and its previous and next buttons.
 */
export type CarouselOptions = {
	/** Its position on the page, from 0. */
	index: number;
	slides: number;
	/** Whether it has a dot for each slide. */
	dots: boolean;
};

export const carouselLabel = (index: number) => `Carousel ${index + 1}`;

export const slideText = (carousel: number, slide: number) =>
	`Carousel ${carousel + 1}, slide ${slide + 1}`;

export const range = (count: number) =>
	Array.from({ length: count }, (_, index) => index);

/** The element every page renders its carousels into. */
export const app = () => {
	const element = document.querySelector<HTMLElement>("#app");
	if (!element) throw new Error("The page has no #app element");
	return element;
};

/** Renders `count` carousels' markup into the page. */
export const renderCarousels = (
	markup: (options: CarouselOptions) => string,
	count: number,
	slides: number,
	dots: boolean,
) => {
	app().innerHTML = range(count)
		.map((index) => markup({ index, slides, dots }))
		.join("");
};
