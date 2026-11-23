import C from "./constants.js";
import type { Carousel, CarouselState, Labels } from "./types.js";

/** A carousel as the library keeps it, with the parts the public API doesn't expose */
export type Instance = {
	api: Carousel;
	/** Runs a clicked `data-carousel--action` or `data-carousel--marker` element */
	handle: (element: Element, event: Event) => void;
	/** Destroys the carousel without telling the registry, for destroying every carousel at once */
	teardown: () => void;
	/** Hands a control or marker over to another carousel */
	release: (element: HTMLElement) => void;
	/** Measures a new carousel, once every carousel starting with it has set its attributes */
	measure: () => void;
	/** Writes a new carousel's state, once every carousel starting with it has measured */
	start: () => void;
};

/** A carousel's state before it starts, and after it is destroyed */
export const emptyState = (): CarouselState => ({
	index: 0,
	count: 0,
	atStart: true,
	atEnd: true,
	scrollable: false,
	playing: false,
});

/** `refresh` runs for every carousel that is refreshed, so listeners can check it again */
export type RegistryListener = (
	type: "create" | "refresh" | "destroy",
	carousel: Carousel,
) => void;

const S: {
	labels: Labels;
	instances: Map<HTMLElement, Instance>;
	abortController: AbortController;
	initialised: boolean;
	/** Told whenever a carousel is created or destroyed, such as by the Catalyst store. Kept across init and destroy. */
	listeners: Set<RegistryListener>;
	/** Counts the ids generated for tracks without one */
	ids: number;
} = {
	labels: { ...C.labels },
	instances: new Map(),
	abortController: new AbortController(),
	initialised: false,
	listeners: new Set(),
	ids: 0,
};

export default S;
