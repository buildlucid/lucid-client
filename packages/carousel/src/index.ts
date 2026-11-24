import lib from "./lib/index.js";

export type {
	Carousel,
	CarouselChange,
	CarouselState,
	Drag,
	Message,
	Messages,
	MessageTokens,
	Options,
} from "./types.js";

export default {
	init: lib.initialise,
	refresh: lib.refresh,
	destroy: lib.destroy,
	get: lib.get,
};
