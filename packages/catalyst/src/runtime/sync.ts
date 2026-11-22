import { initialiseStoreAction } from "../core/store/index.js";
import type {
	Directive,
	ReactionPhase,
	Store,
	SyncOptions,
} from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectDirectives from "./collect-directives.js";
import collectStores from "./collect-stores.js";
import createGlobalEffectDirectives from "./create-global-effect-directives.js";
import disposeStaleDirectives from "./dispose-stale-directives.js";
import initialiseDirective from "./initialise-directive.js";
import { warn } from "./log.js";
import { flushUpdates } from "./reactive.js";

const isWithin = (target: Element, element: Element) =>
	element === target || target.contains(element);

/**
 * Directives outside the target that reference a store created by this sync,
 * such as `data-dom--text="dialog:$label"` after `refresh("dialog")`. They
 * still point at the previous store, or at none, so they initialise again.
 */
const collectScopeDependents = (target: Element, stores: Store[]) => {
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

const initialisePhase = (
	directives: Directive[],
	phase: ReactionPhase,
	shouldInitialise: (directive: Directive) => boolean,
) => {
	for (const directive of directives) {
		const reaction = Catalyst.reactions.get(directive.reaction);
		const reactionPhase = reaction?.phase ?? "afterStoreInit";
		if (reactionPhase !== phase) continue;
		if (shouldInitialise(directive)) initialiseDirective(directive);
	}
};

/** Synchronises a subtree without flushing; used by reactions mid-update. */
export const syncTarget = (target: Element, options?: SyncOptions) => {
	if (!Catalyst.started) return;

	disposeStaleDirectives(target, options);
	const stores = collectStores(target, options);
	const directives = collectDirectives(target, options);
	const dependents = new Set(collectScopeDependents(target, stores));
	directives.push(...dependents);

	// Directives are collected up front, so an earlier reaction may have removed
	// a later directive's element from the target before it initialises.
	const shouldInitialise = (directive: Directive) =>
		dependents.has(directive)
			? directive.element.isConnected
			: isWithin(target, directive.element);

	initialisePhase(directives, "beforeStoreInit", shouldInitialise);
	for (const store of stores) initialiseStoreAction(store);

	directives.push(...createGlobalEffectDirectives(stores));
	initialisePhase(directives, "afterStoreInit", shouldInitialise);
};

const sync = (target: Element, options?: SyncOptions) => {
	if (!Catalyst.started) {
		warn("Catalyst must be started before it can sync.");
		return;
	}
	syncTarget(target, options);
	flushUpdates();
};

export default sync;
