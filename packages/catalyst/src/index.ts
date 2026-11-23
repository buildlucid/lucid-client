import add from "./runtime/add.js";
import destroy from "./runtime/destroy.js";
import refresh from "./runtime/refresh.js";
import start from "./runtime/start.js";
import sync from "./runtime/sync.js";
import type { CatalystApi } from "./types/index.js";

export { default as defineStore } from "./core/define-store.js";
export { snapshot } from "./core/state/create-state.js";
export { flush, untrack } from "solid-js";

const Catalyst: CatalystApi = {
	start,
	add,
	destroy,
	refresh,
	sync,
};

export default Catalyst;
