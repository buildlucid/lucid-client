import DEFAULT_OPTIONS from "./constants.js";
import type { CatalystRuntime } from "./types.js";

const Catalyst: CatalystRuntime = {
	options: DEFAULT_OPTIONS,
	started: false,
	reactions: new Map(),
	stores: new Map(),
	storesByElement: new Map(),
	storeDefinitions: new Map(),
	registrations: new Map(),
	scopeDependents: new Map(),
	reportedReactions: new Set(),
};

export default Catalyst;
