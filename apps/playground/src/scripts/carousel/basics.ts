import { carousel, startCarousel } from "../../lib/carousel";
import { createLogger } from "../../lib/log";

const log = createLogger("basics");

startCarousel();

document
	.querySelector('[data-call="destroy"]')
	?.addEventListener("click", () => {
		const photos = carousel.get("basics-nojs");
		if (!photos) {
			log.warn("The photos carousel is already destroyed");
			return;
		}
		photos.destroy();
		log.info("Destroyed the photos carousel");
	});

document
	.querySelector('[data-call="enhance"]')
	?.addEventListener("click", () => {
		carousel.refresh();
		log.info("Called refresh()", carousel.get("basics-nojs")?.state);
	});
