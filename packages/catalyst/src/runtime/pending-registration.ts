import type { Directive } from "../types/index.js";
import Catalyst from "./catalyst.js";
import disposeRegistration, {
	indexRegistration,
} from "./dispose-registration.js";
import { debug } from "./log.js";
import type { DirectiveRegistration, RuntimeStore } from "./types.js";

/**
 * Registers a directive whose store doesn't exist yet without setting it up,
 * so its element is left as it is. The registration is indexed by scope, so
 * the sync that creates the store initialises it.
 */
export const registerPending = (directive: Directive) => {
	let elementRegistrations = Catalyst.registrations.get(directive.element);
	if (!elementRegistrations) {
		elementRegistrations = new Map();
		Catalyst.registrations.set(directive.element, elementRegistrations);
	}

	const registration: DirectiveRegistration = {
		directive,
		scopeStore: undefined,
		dispose: () => {},
	};
	elementRegistrations.set(directive.attributeName, registration);
	indexRegistration(registration);

	const scope =
		directive.reference && directive.reference.type !== "loop"
			? directive.reference.scope
			: null;
	debug(
		`"${directive.attributeName}" is waiting for a store with the scope "${scope}".`,
	);
};

/**
 * Directives outside a destroyed store that reference it are disposed and
 * wait for a store with that scope again, instead of staying bound to the
 * destroyed one.
 */
export const releaseScopeDependents = (store: RuntimeStore) => {
	const dependents = Catalyst.scopeDependents.get(store.key);
	for (const registration of Array.from(dependents ?? [])) {
		if (registration.scopeStore !== store) continue;
		const element = registration.directive.element;
		// Directives inside the store's element are disposed with its markup.
		if (store.element === element || store.element.contains(element)) {
			continue;
		}
		disposeRegistration(registration);
		if (element.isConnected) registerPending(registration.directive);
	}
};
