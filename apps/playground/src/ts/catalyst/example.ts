import { defineStore } from "@lucidclient/catalyst";

const exampleStore = defineStore({
	state: {
		boolean: false,
		number: 1,
		string: "hello world",
		object: { hello: "world", world: "hello" },
		array: [false, "world"] as (boolean | string)[],
		customState: "hello world",
	},
	computed: ({ state }) => ({
		contentCopy: () => (state.boolean ? "yea im open" : "no imma closed"),
	}),
	actions: ({ setState }) => ({
		handleClick: () => {
			setState((state) => {
				state.boolean = !state.boolean;
			});
		},
	}),
	effects: ({ state, effect }) => ({
		elementEffect: effect(
			() => state.boolean,
			(value, context) => {
				console.log("element effect", value, context);
			},
		),
	}),
	init: ({ actions }) => {
		actions.handleClick();
	},
});

export default exampleStore;
