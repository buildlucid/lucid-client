import lib from "./lib/index.js";

export type {
	Options,
	SpeculationAction,
	SpeculationTrigger,
} from "./types.js";

export default {
	init: lib.initialise,
	refresh: lib.refresh,
	destroy: lib.destroy,
};
