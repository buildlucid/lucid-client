import Catalyst from "./catalyst.js";
import disposeRegistration from "./dispose-registration.js";

/**
 * Disposes directives whose attribute changed or was removed since they were
 * set up. Returns whether any were disposed.
 */
const disposeStaleDirectives = (elements: Element[]) => {
	let disposed = false;
	for (const element of elements) {
		const registrations = Catalyst.registrations.get(element);
		if (!registrations) continue;

		for (const registration of Array.from(registrations.values())) {
			if (
				element.getAttribute(registration.directive.attributeName) !==
				registration.directive.value
			) {
				disposeRegistration(registration);
				disposed = true;
			}
		}
	}
	return disposed;
};

export default disposeStaleDirectives;
