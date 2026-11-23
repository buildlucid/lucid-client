import { defineStore } from "@lucidclient/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("lazyCart");

/** Loaded with a dynamic import and registered with `Catalyst.add`. */
export const lazyCart = defineStore({
	state: { items: 0 },
	computed: ({ state }) => ({
		summary: () =>
			state.items === 1
				? "1 item in the cart"
				: `${state.items} items in the cart`,
	}),
	actions: ({ setState }) => ({
		addItem: () =>
			setState((state) => {
				state.items += 1;
			}),
	}),
	init: ({ state }) => {
		log.success(`init ran with ${state.items} items from the state attribute`);
		return () => log.info("cleanup ran");
	},
});
