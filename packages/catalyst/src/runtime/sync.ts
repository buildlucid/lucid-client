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

/** Whether an element is inside one of the targets, which don't overlap. */
const createWithin = (targets: Element[]) => {
	const [first] = targets;
	if (targets.length === 1 && first) {
		return (element: Element) => element === first || first.contains(element);
	}
	const roots = new Set(targets);
	return (element: Element) => {
		for (let current: Element | null = element; current;) {
			if (roots.has(current)) return true;
			current = current.parentElement;
		}
		return false;
	};
};

const getIgnoreAttribute = () =>
	`${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.ignore}`;

/** Escaped, since a custom prefix such as `c:` isn't valid in a selector. */
const getIgnoreSelector = () => `[${CSS.escape(getIgnoreAttribute())}]`;

/** Whether an element is inside a `data-ignore` element, or is one. */
const isIgnored = (element: Element) =>
	element.closest(getIgnoreSelector()) !== null;

/** Whether markup, such as a template's content, holds a `data-ignore` element. */
export const containsIgnored = (root: ParentNode) =>
	root.querySelector(getIgnoreSelector()) !== null;

/**
 * Directives outside the targets that reference a store created by this sync,
 * such as `data-dom--text="dialog:$label"` after `refresh("dialog")`. They
 * still point at the previous store, or at none, so they initialise again.
 */
const collectScopeDependents = (
	isWithin: (element: Element) => boolean,
	stores: RuntimeStore[],
) => {
	const directives: Directive[] = [];
	for (const store of stores) {
		const dependents = Catalyst.scopeDependents.get(store.key);
		for (const registration of dependents ?? []) {
			if (registration.scopeStore === store) continue;
			const element = registration.directive.element;
			if (!element.isConnected || isWithin(element)) continue;
			// It may have been moved into a `data-ignore` element since.
			if (isIgnored(element)) continue;
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

type TargetsOptions = SyncOptions & {
	/**
	 * Whether the targets may hold `data-ignore` elements. Loops know from
	 * their template, which saves looking inside every item.
	 */
	ignored?: boolean;
};

/**
 * Leaves out elements marked `data-ignore` and everything inside them, so
 * Catalyst never binds their markup. Elements are in document order, so an
 * ignored subtree's elements follow it.
 */
const withoutIgnored = (target: Element, elements: Element[]) => {
	const attribute = getIgnoreAttribute();
	if (!target.querySelector(getIgnoreSelector())) return elements;
	const kept: Element[] = [];
	let ignored: Element | null = null;
	for (const element of elements) {
		if (ignored?.contains(element)) continue;
		if (element.hasAttribute(attribute)) {
			ignored = element;
			continue;
		}
		kept.push(element);
	}
	return kept;
};

const collectTarget = (target: Element, options?: TargetsOptions) => {
	// An ignored target is left out before its subtree is walked.
	if (options?.ignored !== false && target.hasAttribute(getIgnoreAttribute())) {
		return [];
	}
	const elements = collectElements(target, options);
	return options?.ignored === false
		? elements
		: withoutIgnored(target, elements);
};

/**
 * Synchronises several subtrees that don't overlap, such as the items a loop
 * renders, in one pass, without flushing. Each phase runs for every target
 * before the next, so stores start once every target's refs are registered.
 */
export const syncTargets = (targets: Element[], options?: TargetsOptions) => {
	if (!Catalyst.initialised || targets.length === 0) return;
	noteSync();

	const collect = () =>
		targets.length === 1 && targets[0]
			? collectTarget(targets[0], options)
			: targets.flatMap((target) => collectTarget(target, options));
	let elements = collect();
	// A disposed directive's cleanup may have changed the markup.
	if (disposeStaleDirectives(elements)) elements = collect();
	const stores = collectStores(elements);
	const directives = collectDirectives(elements);
	const isWithin = createWithin(targets);
	const dependents = new Set(collectScopeDependents(isWithin, stores));
	directives.push(...dependents);

	// Directives are collected up front, so an earlier reaction may have removed
	// a later directive's element from the targets before it initialises.
	const shouldInitialise = (directive: Directive) =>
		dependents.has(directive)
			? directive.element.isConnected
			: isWithin(directive.element);

	const phases = splitByPhase(directives);
	for (const directive of phases.beforeStoreInit) {
		if (shouldInitialise(directive)) initialiseDirective(directive);
	}
	for (const store of stores) startStore(store);
	for (const directive of phases.afterStoreInit) {
		if (shouldInitialise(directive)) initialiseDirective(directive);
	}
};

/**
 * Synchronises a subtree without flushing; used by reactions mid-update. A
 * target inside a `data-ignore` element is left alone. Reactions that render
 * markup, such as loops, sync it with `syncTargets`, since they are never
 * inside one.
 */
export const syncTarget = (target: Element, options?: SyncOptions) => {
	if (target.parentElement && isIgnored(target.parentElement)) return;
	syncTargets([target], options);
};

const sync = (target: Element, options?: SyncOptions) => {
	if (!Catalyst.initialised) {
		if (__DEV__) warn("Catalyst must be initialised before it can sync.");
		return;
	}
	syncTarget(target, options);
	flushUpdates();
};

export default sync;
