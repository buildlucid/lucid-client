import { onCleanup } from "solid-js";
import type { Directive, ReactionContext } from "../types/index.js";
import Catalyst from "./catalyst.js";
import disposeRegistration, {
	indexRegistration,
} from "./dispose-registration.js";
import disposeSubtree from "./dispose-subtree.js";
import { debug, warn } from "./log.js";
import { registerPending } from "./pending-registration.js";
import { createOwnedRoot } from "./reactive.js";
import resolveReference from "./resolve-reference.js";
import { syncTarget } from "./sync.js";
import type { DirectiveRegistration, RuntimeStore } from "./types.js";

const context: ReactionContext = {
	getStore: (scope) => Catalyst.stores.get(scope),
	resolve: resolveReference,
	sync: (target, options) => syncTarget(target, options),
	disposeSubtree,
	warn,
	debug,
};

const getScope = (directive: Directive) => {
	const reference = directive.reference;
	if (!reference || reference.type === "loop") return null;
	return reference.scope;
};

const getScopeStore = (directive: Directive): RuntimeStore | undefined => {
	const scope = getScope(directive);
	return scope ? Catalyst.stores.get(scope) : undefined;
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
	if (left.type !== "loop" && right.type !== "loop") {
		return left.loop === right.loop;
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
	scopeStore: RuntimeStore | undefined,
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

	// A directive referencing a store that doesn't exist yet waits for it,
	// leaving its element untouched until a sync creates the store.
	if (getScope(directive) && !scopeStore) {
		registerPending(directive);
		return;
	}

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
