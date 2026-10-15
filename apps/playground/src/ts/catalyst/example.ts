import { createSignal, defineStoreModule } from "@lucidclient/catalyst";

const exampleStore = defineStoreModule({
	state: () => ({
		boolean: createSignal(false),
		number: createSignal(1),
		string: createSignal("hello world"),
		object: createSignal({ hello: "world", world: "hello" }),
		array: createSignal([false, "world"]),
		customState: createSignal("hello world"),
	}),
	setup: (store) => {
		const handleClick = () => {
			const [, setBoolean] = store.state.boolean;
			// const [getNumber] = store.state.number;
			// const [getString] = store.state.string;
			// const [getObject] = store.state.object;
			// const [getArray] = store.state.array;
			// const [getCustomState] = store.state.customState;

			// console.log(getNumber());
			// console.log(getString());
			// console.log(getObject());
			// console.log(getArray());
			// console.log(getCustomState());
			// console.log(store.refs.get("button"));

			setBoolean((previous) => !previous);
		};

		return {
			actions: {
				init: handleClick,
				contentCopy: () => {
					const [getBoolean] = store.state.boolean;
					return getBoolean() ? "yea im open" : "no imma closed";
				},
				handleClick,
			},
			effects: {
				manual: {
					elementEffect: (context) => {
						console.log("element effect", context);
					},
				},
			},
		};
	},
});

export default exampleStore;
