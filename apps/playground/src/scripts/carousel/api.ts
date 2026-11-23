import { carousel, startCarousel } from "../../lib/carousel";
import { createLogger, formatData } from "../../lib/log";

const log = createLogger("api");

startCarousel();

const main = carousel.get("api-main");
const readout = document.querySelector<HTMLElement>("[data-state-readout]");
const render = () => {
	if (readout && main) readout.textContent = formatData(main.state);
};
render();
main?.subscribe(render);

const input = document.querySelector<HTMLInputElement>("[data-goto-input]");
const host = document.querySelector<HTMLElement>("[data-dynamic-host]");
const template = document.querySelector<HTMLTemplateElement>(
	"[data-dynamic-template]",
);

const calls: Record<string, () => void> = {
	prev: () => main?.prev(),
	next: () => main?.next(),
	goTo: () => {
		const index = Number(input?.value ?? 0);
		main?.goTo(index);
		log.info(`goTo(${index})`);
	},
	play: () => main?.play(),
	pause: () => main?.pause(),
	add: () => {
		if (!host || !template) return;
		if (document.getElementById("api-added")) {
			log.warn("The added carousel is already on the page");
			return;
		}
		host.append(template.content.cloneNode(true));
		carousel.refresh();
		log.success("Added a carousel and called refresh()", {
			count: carousel.get("api-added")?.state.count,
		});
	},
	remove: () => {
		const added = document.getElementById("api-added");
		if (!added) {
			log.warn("There is no added carousel to remove");
			return;
		}
		added.remove();
		carousel.refresh();
		log.info("Removed it and called refresh()", {
			get: carousel.get(added) ?? "undefined",
		});
	},
};

document.addEventListener("click", (event) => {
	if (!(event.target instanceof Element)) return;
	const button = event.target.closest<HTMLElement>("[data-call]");
	const call = button?.dataset.call;
	if (call && calls[call]) calls[call]();
});
