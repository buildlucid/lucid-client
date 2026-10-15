import { createSignal, defineStoreModule } from "@lucidclient/catalyst";

const loopsStore = defineStoreModule({
	state: () => ({
		items: createSignal([
			{ title: "title one", url: "/one" },
			{ title: "title two", url: "/two" },
			{ title: "title threee", url: "/three" },
		]),
	}),
	setup: (store) => ({
		actions: {
			init: () => {
				console.log("store", store);
			},
			childOnClick: () => {
				const [getItems, setItems] = store.state.items;
				const items = getItems();
				items.push({ title: "A new title?", url: "/new" });
				setItems([...items]);
			},
			getItems: () => {
				const [getItems] = store.state.items;
				return getItems();
			},
		},
	}),
});

export default loopsStore;
