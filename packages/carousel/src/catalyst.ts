import { defineStore } from "@lucidclient/catalyst";
import type { LoopItem, StateSetter } from "@lucidclient/catalyst/types";
import lib from "./lib/index.js";
import S, { emptyState, type RegistryListener } from "./state.js";
import type { Carousel, CarouselState } from "./types.js";

/** Copies only what changed, so bindings that read unchanged state don't run again */
const syncState = (
	setState: StateSetter<CarouselState>,
	next: CarouselState,
) => {
	setState((draft) => {
		for (const key of Object.keys(next) as Array<keyof CarouselState>) {
			if (draft[key] !== next[key]) (draft[key] as unknown) = next[key];
		}
	});
};

/** Reads a page index from a number, a loop item, or an event followed by a loop item */
const readIndex = (first: unknown, second: unknown): number | undefined => {
	if (typeof first === "number") return first;
	const item = (
		first instanceof Event ? second : first
	) as Partial<LoopItem> | null;
	return typeof item?.index === "number" ? item.index : undefined;
};

/**
 * A Catalyst store that follows the carousel registered as its `#carousel` ref
 * - `$index`, `$indexOne`, `$count`, `$atStart`, `$atEnd`, `$scrollable` and `$playing` read its state, and `$pages` lists its page indexes for `data-loop`
 * - `@next`, `@prev`, `@goTo`, `@play`, `@pause` and `@toggle` control it, and `@isCurrent` reads whether a loop item's page is the current one
 * - Register it under any scope: `Catalyst.start({ stores: { gallery: carouselStore } })`
 */
export const carouselStore = defineStore({
	state: emptyState,
	computed: ({ state }) => ({
		indexOne: () => state.index + 1,
		pages: () => Array.from({ length: state.count }, (_, index) => index),
	}),
	actions: ({ state, refs }) => {
		const carousel = (): Carousel | undefined => {
			const element = refs.get("carousel");
			return element ? lib.get(element) : undefined;
		};
		return {
			next: () => carousel()?.next(),
			prev: () => carousel()?.prev(),
			/** `@goTo` takes a page index, or reads one from the loop item it is called in */
			goTo: (first?: unknown, second?: unknown) => {
				const index = readIndex(first, second);
				if (index !== undefined) carousel()?.goTo(index);
			},
			play: () => carousel()?.play(),
			pause: () => carousel()?.pause(),
			toggle: () => carousel()?.toggle(),
			/** Whether a loop item, such as one of `$pages`, is the current page */
			isCurrent: (item?: LoopItem) => item?.index === state.index,
		};
	},
	init: ({ refs, setState }) => {
		let attached: Carousel | undefined;
		let unsubscribe: (() => void) | undefined;

		const detach = () => {
			unsubscribe?.();
			unsubscribe = undefined;
			attached = undefined;
		};
		const attach = (carousel: Carousel) => {
			if (attached === carousel) return;
			detach();
			attached = carousel;
			unsubscribe = carousel.subscribe((next) => syncState(setState, next));
			syncState(setState, carousel.state);
		};

		const reset = () => {
			detach();
			syncState(setState, emptyState());
		};
		const listener: RegistryListener = (type, carousel) => {
			if (type === "destroy") {
				if (attached === carousel) reset();
				return;
			}
			// A refresh checks the ref again, as it may have been added or moved since the store started.
			const element = refs.get("carousel");
			const current = element ? lib.get(element) : undefined;
			if (current === carousel) attach(carousel);
			else if (attached === carousel) reset();
		};

		// The carousel may be enhanced before or after Catalyst starts.
		const element = refs.get("carousel");
		const existing = element ? lib.get(element) : undefined;
		if (existing) attach(existing);
		S.listeners.add(listener);

		return () => {
			S.listeners.delete(listener);
			detach();
		};
	},
});
