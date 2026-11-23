import { destroyStore } from "../core/store/index.js";
import Catalyst from "./catalyst.js";
import DEFAULT_OPTIONS from "./constants.js";
import disposeRegistration from "./dispose-registration.js";
import { debug } from "./log.js";
import { disposeRuntimeOwner } from "./reactive.js";

const attempt = (fn: () => void) => {
	try {
		fn();
	} catch (error) {
		console.error(error);
	}
};

/** Always resets the runtime, even when a cleanup throws. */
const destroy = () => {
	try {
		Catalyst.removalObserver?.disconnect();

		const registrations = Array.from(Catalyst.registrations.values()).flatMap(
			(items) => Array.from(items.values()),
		);
		for (const registration of registrations) {
			attempt(() => disposeRegistration(registration));
		}

		for (const store of Array.from(Catalyst.stores.values())) {
			attempt(() => destroyStore(store));
		}

		attempt(disposeRuntimeOwner);
	} finally {
		Catalyst.removalObserver = undefined;
		Catalyst.registrations.clear();
		Catalyst.scopeDependents.clear();
		Catalyst.stores.clear();
		Catalyst.storesByElement.clear();
		Catalyst.reportedReactions.clear();
		Catalyst.started = false;
		Catalyst.startOptions = undefined;
		Catalyst.options = DEFAULT_OPTIONS;
	}
	if (__DEV__) debug("Library destroyed.");
};

export default destroy;
