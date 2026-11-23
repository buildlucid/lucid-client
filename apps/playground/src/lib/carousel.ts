import carousel, {
	type CarouselChange,
	type Options,
} from "@lucidclient/carousel";
import { createLogger } from "./log";

const log = createLogger("carousel");

const name = (element: Element) =>
	element.getAttribute("aria-label") ?? element.id ?? "carousel";

/**
 * Starts the carousel library and logs every page change. Each carousel page
 * calls this once.
 */
export const startCarousel = (options?: Options) => {
	document.addEventListener("carousel-change", (event) => {
		if (!(event.target instanceof Element)) return;
		const { index, previousIndex, count } = (
			event as CustomEvent<CarouselChange>
		).detail;
		log.info(
			`${name(event.target)}: page ${previousIndex + 1} → ${index + 1} of ${count}`,
		);
	});
	carousel.init(options);
};

export { carousel };
