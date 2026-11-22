import Catalyst from "./catalyst.js";
import type { DirectiveRegistration } from "./types.js";

const getRegistrationScope = (registration: DirectiveRegistration) => {
	const reference = registration.directive.reference;
	if (!reference || reference.type === "loop") return null;
	return reference.scope;
};

export const indexRegistration = (registration: DirectiveRegistration) => {
	const scope = getRegistrationScope(registration);
	if (!scope) return;
	let dependents = Catalyst.scopeDependents.get(scope);
	if (!dependents) {
		dependents = new Set();
		Catalyst.scopeDependents.set(scope, dependents);
	}
	dependents.add(registration);
};

const unindexRegistration = (registration: DirectiveRegistration) => {
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
