import type { SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import disposeRegistration from "./dispose-registration.js";

const disposeStaleDirectives = (target: Element, options?: SyncOptions) => {
	for (const element of collectElements(target, options)) {
		const registrations = Catalyst.registrations.get(element);
		if (!registrations) continue;

		for (const registration of Array.from(registrations.values())) {
			if (registration.directive.synthetic) continue;
			if (
				element.getAttribute(registration.directive.attributeName) !==
				registration.directive.value
			) {
				disposeRegistration(registration);
			}
		}
	}
};

export default disposeStaleDirectives;
