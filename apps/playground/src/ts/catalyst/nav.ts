import Catalyst, { defineStore } from "@lucidclient/catalyst";

const navStore = defineStore({
	state: {
		open: false,
	},
	computed: ({ state }) => ({
		closed: () => !state.open,
		buttonLabel: () => (state.open ? "Close Navigation" : "Open Navigation"),
	}),
	actions: ({ setState, refs }) => ({
		toggle: () => {
			setState((state) => {
				state.open = !state.open;
			});
		},
		replaceChild: () => {
			const target = refs.get("testEleRefresh");
			if (!target) return;
			target.innerHTML =
				"<button data-store='testreplace' data-state--example='false' data-events--click='nav:@newClick' data-bind--testing='nav:$open'>after<span data-bind--test='$example'>children</span></button>";
			Catalyst.sync(target);
		},
		newClick: () => {
			console.log("newClick");
		},
		oldClick: () => {
			console.log("oldClick");
		},
		documentScroll: () => {
			// console.log("document scrolled");
		},
	}),
	effects: ({ state, effect }) => ({
		logOpen: effect(
			() => state.open,
			(open, context) => {
				console.log("effect", open, context);
			},
		),
	}),
	init: () => () => {
		console.log("CLEANEDUP");
	},
});

export default navStore;
