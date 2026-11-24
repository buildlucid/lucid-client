import Catalyst from "@lucidclient/catalyst";
import {
	bind,
	classes,
	conditional,
	css,
	dom,
	events,
	intersect,
	loop,
	model,
	trap,
	uid,
} from "@lucidclient/catalyst/reactions";
import type { CatalystInitOptions } from "@lucidclient/catalyst/types";

/** Every first-party reaction. Pages pass their own list to test fewer. */
export const allReactions = [
	bind,
	classes,
	conditional,
	css,
	dom,
	events,
	intersect,
	loop,
	model,
	trap,
	uid,
];

/**
 * Initialises Catalyst in debug mode with every first-party reaction, unless the
 * page passes its own. Each page registers only its own stores.
 */
export const initCatalyst = (options: CatalystInitOptions = {}) => {
	Catalyst.init({
		debug: true,
		reactions: allReactions,
		...options,
	});
};
