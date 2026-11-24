import { refsReaction } from "../core/refs/index.js";
import type { CatalystInitOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import DEFAULT_OPTIONS from "./constants.js";
import { debug, warn } from "./log.js";
import { createRuntimeOwner, flushUpdates } from "./reactive.js";
import registerReaction from "./register-reaction.js";
import registerRemovalObserver from "./register-removal-observer.js";
import { registerStores } from "./register-store.js";
import { syncTarget } from "./sync.js";

/** Reactions every application gets, because stores depend on them. */
const CORE_REACTIONS = [refsReaction];

let pendingInit = false;

const init = (options?: CatalystInitOptions) => {
	if (Catalyst.initialised) {
		if (__DEV__) warn("Catalyst has already been initialised.");
		return;
	}

	// Scripts in <head> without `defer` run before <body> exists.
	if (!document.body) {
		if (pendingInit) return;
		pendingInit = true;
		document.addEventListener(
			"DOMContentLoaded",
			() => {
				pendingInit = false;
				init(options);
			},
			{ once: true },
		);
		return;
	}

	Catalyst.options = {
		debug: options?.debug ?? DEFAULT_OPTIONS.debug,
		attributes: {
			prefix: options?.attributes?.prefix ?? DEFAULT_OPTIONS.attributes.prefix,
			store: options?.attributes?.store ?? DEFAULT_OPTIONS.attributes.store,
			state: options?.attributes?.state ?? DEFAULT_OPTIONS.attributes.state,
			persist:
				options?.attributes?.persist ?? DEFAULT_OPTIONS.attributes.persist,
			ignore: options?.attributes?.ignore ?? DEFAULT_OPTIONS.attributes.ignore,
			scopeSeparator:
				options?.attributes?.scopeSeparator ??
				DEFAULT_OPTIONS.attributes.scopeSeparator,
			specifierSeparator:
				options?.attributes?.specifierSeparator ??
				DEFAULT_OPTIONS.attributes.specifierSeparator,
		},
	};
	Catalyst.initOptions = options;
	// Kept when Catalyst is initialised again, like registered stores and reactions.
	if (options?.persistence) Catalyst.persistence = options.persistence;

	registerStores(options?.stores);
	for (const reaction of [...CORE_REACTIONS, ...(options?.reactions ?? [])]) {
		// Initialising again passes the reactions it already registered. Any other
		// reaction reusing a name or attribute is refused with a warning.
		if (Catalyst.reactions.get(reaction.name) === reaction) continue;
		registerReaction(reaction);
	}

	Catalyst.reactionAttributes = new Map(
		Array.from(Catalyst.reactions.values(), (reaction) => [
			`${Catalyst.options.attributes.prefix}${reaction.attribute}`,
			reaction,
		]),
	);

	createRuntimeOwner();
	Catalyst.initialised = true;
	// Observe before the first sync so removals made while it runs are seen.
	Catalyst.removalObserver = registerRemovalObserver();
	syncTarget(document.body);
	flushUpdates();
	if (__DEV__) debug("Library initialised.");
};

export default init;
