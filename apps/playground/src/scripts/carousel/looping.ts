import { carousel, startCarousel } from "../../lib/carousel";
import { createLogger } from "../../lib/log";

const log = createLogger("looping");

startCarousel();

/** Shows the order slides are laid out in, next to their DOM order. */
for (const readout of document.querySelectorAll<HTMLElement>(
	"[data-order-readout]",
)) {
	const instance = carousel.get(readout.dataset.orderReadout ?? "");
	if (!instance) continue;
	const { track } = instance;
	const render = () => {
		const slides = Array.from(track.children).filter(
			(child): child is HTMLElement => child instanceof HTMLElement,
		);
		const name = (slide: HTMLElement) => slide.dataset.name ?? "?";
		const laidOut = [...slides]
			.sort((a, b) => Number(a.style.order) - Number(b.style.order))
			.map(name);
		readout.textContent = [
			`laid out  ${laidOut.join("  ")}`,
			`DOM order ${slides.map(name).join("  ")}`,
		].join("\n");
	};
	render();
	new MutationObserver(render).observe(track, {
		attributes: true,
		attributeFilter: ["style"],
		subtree: true,
	});
}

document.addEventListener("click", (event) => {
	if (!(event.target instanceof Element)) return;
	const target = event.target.closest<HTMLElement>("[data-log-click]");
	if (!target) return;
	if (target instanceof HTMLAnchorElement) event.preventDefault();
	log.success(target.dataset.logClick ?? "Clicked");
});
