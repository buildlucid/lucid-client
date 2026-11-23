import add from "./runtime/add.js";
import clearPersisted from "./runtime/clear-persisted.js";
import destroy from "./runtime/destroy.js";
import refresh from "./runtime/refresh.js";
import start from "./runtime/start.js";
import sync from "./runtime/sync.js";
import type { CatalystApi } from "./types/index.js";

export { default as defineStore } from "./core/define-store.js";
export { default as persisted } from "./core/persist/persisted.js";
export { flush, snapshot, untrack } from "solid-js";

const Catalyst: CatalystApi = {
	start,
	add,
	destroy,
	refresh,
	sync,
	clearPersisted,
};

export default Catalyst;
