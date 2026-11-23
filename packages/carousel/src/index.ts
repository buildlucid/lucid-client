import lib from "./lib/index.js";

export type {
	Carousel,
	CarouselChange,
	CarouselState,
	Drag,
	Labels,
	Options,
} from "./types.js";

export default {
	init: lib.initialise,
	refresh: lib.refresh,
	destroy: lib.destroy,
	get: lib.get,
};
