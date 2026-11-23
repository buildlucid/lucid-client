import Catalyst from "@lucidclient/catalyst";
import { bind, dom, events, loop, trap } from "@lucidclient/catalyst/reactions";
import type { CatalystStartOptions } from "@lucidclient/catalyst/types";

/** Every first-party reaction. Pages pass their own list to test fewer. */
export const allReactions = [bind, dom, events, loop, trap];

/**
 * Starts Catalyst in debug mode with every first-party reaction, unless the
 * page passes its own. Each page starts only its own stores.
 */
export const startCatalyst = (options: CatalystStartOptions = {}) => {
	Catalyst.start({
		debug: true,
		reactions: allReactions,
		...options,
	});
};
