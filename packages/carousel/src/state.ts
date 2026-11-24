import type { Context } from "./carousel/context.js";
import C from "./constants.js";
import type { Carousel, CarouselState, Messages } from "./types.js";

/** A carousel as the library keeps it, with the parts the public API doesn't expose */
export type Instance = {
	api: Carousel;
	/** Runs a clicked `data-carousel--action` or `data-carousel--marker` element */
	handle: (element: Element, event: Event) => void;
	/** Destroys the carousel without telling the registry, for destroying every carousel at once */
	teardown: () => void;
	/** Puts the markup back as it was rendered, keeping the listeners, so it can be read again */
	reset: () => void;
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

const S: {
	/** The messages passed to `init`, over the English defaults */
	messages: Messages;
	instances: Map<HTMLElement, Instance>;
	abortController: AbortController;
	initialised: boolean;
	/** Mouse dragging, when `init` was given it */
	drag: ((ctx: Context) => void) | undefined;
	/** Counts the ids generated for tracks without one */
	ids: number;
} = {
	messages: { ...C.messages },
	instances: new Map(),
	abortController: new AbortController(),
	initialised: false,
	drag: undefined,
	ids: 0,
};

export default S;
