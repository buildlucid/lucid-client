import { carouselStore } from "@lucidclient/carousel/catalyst";
import { defineStore } from "@lucidclient/catalyst";
import { carousel, startCarousel } from "../../lib/carousel";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("photos");

type Photo = { id: number; label: string; hue: number };

let nextId = 1;
const photo = (): Photo => {
	const id = nextId++;
	return { id, label: `Photo ${id}`, hue: (id * 47) % 360 };
};

const photos = defineStore({
	state: {
		items: Array.from({ length: 5 }, photo),
	},
	computed: ({ state }) => ({
		empty: () => state.items.length === 0,
	}),
	actions: ({ state, setState }) => ({
		add: () => {
			const added = photo();
			setState((draft) => {
				draft.items.push(added);
			});
			log.info(`Added ${added.label}`);
		},
		remove: () => {
			// The loop's slides follow the items' order, after its <template>.
			const instance = carousel.get("catalyst-slides");
			const slides = Array.from(instance?.track.children ?? []).filter(
				(child) => child.localName !== "template",
			);
			const current = slides.findIndex((slide) =>
				slide.hasAttribute("data-carousel--active"),
			);
			const index = current >= 0 ? current : state.items.length - 1;
			const item = state.items[index];
			if (!item) return;
			setState((draft) => {
				draft.items.splice(index, 1);
			});
			log.info(`Removed ${item.label}`);
		},
	}),
});

startCarousel();
startCatalyst({
	stores: {
		storeControls: carouselStore,
		storeMarkers: carouselStore,
		storeSlides: carouselStore,
		photos,
	},
});
