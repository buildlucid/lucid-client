import { carousel, startCarousel } from "../../lib/carousel";
import { createLogger } from "../../lib/log";

const log = createLogger("autoplay");

startCarousel();

for (const id of ["autoplay-rotation", "autoplay-text"]) {
	const instance = carousel.get(id);
	let playing = instance?.state.playing;
	log.info(`${id} starts ${playing ? "playing" : "stopped"}`);
	instance?.subscribe((state) => {
		if (state.playing === playing) return;
		playing = state.playing;
		log.info(`${id} ${playing ? "started" : "stopped"}`);
	});
}

// Following links in the inert scenario would jump the page.
document
	.querySelector("#autoplay-inert")
	?.addEventListener("click", (event) => {
		if (event.target instanceof HTMLAnchorElement) {
			event.preventDefault();
			log.success(`Followed ${event.target.textContent}`);
		}
	});
