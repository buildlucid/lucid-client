import { refsReaction } from "../core/refs/index.js";
import type { CatalystStartOptions } from "../types/index.js";
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

let pendingStart = false;

const start = (options?: CatalystStartOptions) => {
	if (Catalyst.started) {
		warn("Catalyst has already been started.");
		return;
	}

	// Scripts in <head> without `defer` run before <body> exists.
	if (!document.body) {
		if (pendingStart) return;
		pendingStart = true;
		document.addEventListener(
			"DOMContentLoaded",
			() => {
				pendingStart = false;
				start(options);
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
			scopeSeparator:
				options?.attributes?.scopeSeparator ??
				DEFAULT_OPTIONS.attributes.scopeSeparator,
			specifierSeparator:
				options?.attributes?.specifierSeparator ??
				DEFAULT_OPTIONS.attributes.specifierSeparator,
		},
	};
	Catalyst.startOptions = options;

	registerStores(options?.stores);
	for (const reaction of [...CORE_REACTIONS, ...(options?.reactions ?? [])]) {
		if (!Catalyst.reactions.has(reaction.name)) registerReaction(reaction);
	}

	createRuntimeOwner();
	Catalyst.started = true;
	// Observe before the first sync so removals made while it runs are seen.
	Catalyst.removalObserver = registerRemovalObserver();
	syncTarget(document.body);
	flushUpdates();
	debug("Library started.");
};

export default start;
