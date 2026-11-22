import { onCleanup } from "solid-js";
import type { ReactionContext, Directive, Store } from "../types/index.js";
import Catalyst from "./catalyst.js";
import disposeRegistration, {
	indexRegistration,
} from "./dispose-registration.js";
import disposeSubtree from "./dispose-subtree.js";
import { debug, warn } from "./log.js";
import { createOwnedRoot } from "./reactive.js";
import resolveReference from "./resolve-reference.js";
import { syncTarget } from "./sync.js";
import type { DirectiveRegistration } from "./types.js";

const context: ReactionContext = {
	getStore: (scope) => Catalyst.stores.get(scope),
	resolve: resolveReference,
	sync: (target, options) => syncTarget(target, options),
	disposeSubtree,
	warn,
	debug,
};

const getScopeStore = (directive: Directive): Store | undefined => {
	const reference = directive.reference;
	if (!reference || reference.type === "loop" || !reference.scope) {
		return undefined;
	}
	return Catalyst.stores.get(reference.scope);
};

const referencesMatch = (
	left: Directive["reference"],
	right: Directive["reference"],
) => {
	if (!left || !right) return left === right;
	if (
		left.raw !== right.raw ||
		left.type !== right.type ||
		left.scope !== right.scope ||
		left.key !== right.key ||
		left.path.join(".") !== right.path.join(".")
	) {
		return false;
	}
	if (left.type === "loop" && right.type === "loop") {
		return left.context === right.context;
	}
	return true;
};

/**
 * A registration is only reused when the directive is unchanged and its scope
 * still resolves to the same store. A store that was refreshed, or that did
 * not exist when the directive first ran, causes it to initialise again.
 */
const registrationMatches = (
	registration: DirectiveRegistration,
	directive: Directive,
	scopeStore: Store | undefined,
) =>
	registration.scopeStore === scopeStore &&
	registration.directive.reaction === directive.reaction &&
	registration.directive.specifier === directive.specifier &&
	registration.directive.value === directive.value &&
	referencesMatch(registration.directive.reference, directive.reference);

const initialiseDirective = (directive: Directive) => {
	const reaction = Catalyst.reactions.get(directive.reaction);
	if (!reaction) return;

	const scopeStore = getScopeStore(directive);
	const existing = Catalyst.registrations
		.get(directive.element)
		?.get(directive.attributeName);
	if (existing && registrationMatches(existing, directive, scopeStore)) return;
	if (existing) disposeRegistration(existing);

	let elementRegistrations = Catalyst.registrations.get(directive.element);
	if (!elementRegistrations) {
		elementRegistrations = new Map();
		Catalyst.registrations.set(directive.element, elementRegistrations);
	}

	const registration: DirectiveRegistration = {
		directive,
		scopeStore,
		dispose: () => {},
	};
	elementRegistrations.set(directive.attributeName, registration);
	indexRegistration(registration);

	registration.dispose = createOwnedRoot((disposeRoot) => {
		try {
			const cleanup = reaction.setup(directive, context);
			if (cleanup) {
				onCleanup(() => {
					try {
						cleanup();
					} catch (error) {
						console.error(error);
					}
				});
			}
		} catch (error) {
			console.error(error);
		}
		return disposeRoot;
	});
};

export default initialiseDirective;
