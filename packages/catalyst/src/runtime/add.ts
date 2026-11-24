import type { CatalystAddOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import refresh from "./refresh.js";
import { registerStores } from "./register-store.js";

/**
 * Registers stores after `init`, such as ones loaded on demand. A store whose
 * element is already on the page is rebuilt with its new definition.
 */
const add = (options: CatalystAddOptions) => {
	const added = registerStores(options.stores);
	if (!Catalyst.initialised) return;
	for (const key of added) {
		if (Catalyst.stores.has(key)) refresh(key);
	}
};

export default add;
