import Catalyst from "./catalyst.js";
import type { DirectiveRegistration } from "./types.js";

const getRegistrationScope = (registration: DirectiveRegistration) => {
	const reference = registration.directive.reference;
	if (!reference || reference.type === "loop") return null;
	return reference.scope;
};

/**
 * Indexes a directive by the store scope it references, so it can follow that
 * store when it is created, refreshed or destroyed. Directives inside their
 * store's element are disposed and set up again with it, so only those outside
 * it, or waiting for it, are indexed.
 */
export const indexRegistration = (registration: DirectiveRegistration) => {
	const scope = getRegistrationScope(registration);
	if (!scope) return;
	const store = registration.scopeStore;
	if (store?.element.contains(registration.directive.element)) return;
	let dependents = Catalyst.scopeDependents.get(scope);
	if (!dependents) {
		dependents = new Set();
		Catalyst.scopeDependents.set(scope, dependents);
	}
	dependents.add(registration);
	registration.indexed = true;
};

const unindexRegistration = (registration: DirectiveRegistration) => {
	if (!registration.indexed) return;
	registration.indexed = false;
	const scope = getRegistrationScope(registration);
	if (!scope) return;
	const dependents = Catalyst.scopeDependents.get(scope);
	if (!dependents) return;
	dependents.delete(registration);
	if (dependents.size === 0) Catalyst.scopeDependents.delete(scope);
};

const disposeRegistration = (registration: DirectiveRegistration) => {
	const elementRegistrations = Catalyst.registrations.get(
		registration.directive.element,
	);
	if (
		elementRegistrations?.get(registration.directive.attributeName) ===
		registration
	) {
		elementRegistrations.delete(registration.directive.attributeName);
		if (elementRegistrations.size === 0) {
			Catalyst.registrations.delete(registration.directive.element);
		}
	}
	unindexRegistration(registration);

	const dispose = registration.dispose;
	registration.dispose = () => {};
	try {
		dispose();
	} catch (error) {
		console.error(error);
	}
};

export default disposeRegistration;
