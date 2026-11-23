import { startStore } from "../core/store/index.js";
import type { Directive, ReactionPhase, SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectDirectives from "./collect-directives.js";
import collectElements from "./collect-elements.js";
import collectStores from "./collect-stores.js";
import disposeStaleDirectives from "./dispose-stale-directives.js";
import initialiseDirective from "./initialise-directive.js";
import { warn } from "./log.js";
import { flushUpdates } from "./reactive.js";
import { noteSync } from "./released.js";
import type { RuntimeStore } from "./types.js";

const isWithin = (target: Element, element: Element) =>
	element === target || target.contains(element);

/**
 * Directives outside the target that reference a store created by this sync,
 * such as `data-dom--text="dialog:$label"` after `refresh("dialog")`. They
 * still point at the previous store, or at none, so they initialise again.
 */
const collectScopeDependents = (target: Element, stores: RuntimeStore[]) => {
	const directives: Directive[] = [];
	for (const store of stores) {
		const dependents = Catalyst.scopeDependents.get(store.key);
		for (const registration of dependents ?? []) {
			if (registration.scopeStore === store) continue;
			const element = registration.directive.element;
			if (!element.isConnected || isWithin(target, element)) continue;
			directives.push(registration.directive);
		}
	}
	return directives;
};

/** Splits directives by the phase their reaction is set up in. */
const splitByPhase = (directives: Directive[]) => {
	const phases: Record<ReactionPhase, Directive[]> = {
		beforeStoreInit: [],
		afterStoreInit: [],
	};
	for (const directive of directives) {
		const reaction = Catalyst.reactions.get(directive.reaction);
		phases[reaction?.phase ?? "afterStoreInit"].push(directive);
	}
	return phases;
};

/** Synchronises a subtree without flushing; used by reactions mid-update. */
export const syncTarget = (target: Element, options?: SyncOptions) => {
	if (!Catalyst.started) return;
	noteSync();

	let elements = collectElements(target, options);
	// A disposed directive's cleanup may have changed the markup.
	if (disposeStaleDirectives(elements)) {
		elements = collectElements(target, options);
	}
	const stores = collectStores(elements);
	const directives = collectDirectives(elements);
	const dependents = new Set(collectScopeDependents(target, stores));
	directives.push(...dependents);

	// Directives are collected up front, so an earlier reaction may have removed
	// a later directive's element from the target before it initialises.
	const shouldInitialise = (directive: Directive) =>
		dependents.has(directive)
			? directive.element.isConnected
			: isWithin(target, directive.element);

	const phases = splitByPhase(directives);
	for (const directive of phases.beforeStoreInit) {
		if (shouldInitialise(directive)) initialiseDirective(directive);
	}
	for (const store of stores) startStore(store);
	for (const directive of phases.afterStoreInit) {
		if (shouldInitialise(directive)) initialiseDirective(directive);
	}
};

const sync = (target: Element, options?: SyncOptions) => {
	if (!Catalyst.started) {
		if (__DEV__) warn("Catalyst must be started before it can sync.");
		return;
	}
	syncTarget(target, options);
	flushUpdates();
};

export default sync;
