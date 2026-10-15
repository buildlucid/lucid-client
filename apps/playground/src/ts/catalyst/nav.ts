import Catalyst, {
	createSignal,
	defineStoreModule,
} from "@lucidclient/catalyst";

const navStore = defineStoreModule({
	state: () => ({
		open: createSignal(false),
		ariaLabel: createSignal("Open Navigation"),
	}),
	setup: (store) => ({
		actions: {
			toggle: () => {
				const [getOpen, setOpen] = store.state.open;
				const [, setAriaLabel] = store.state.ariaLabel;

				setAriaLabel(getOpen() ? "Open Navigation" : "Close Navigation");
				setOpen((previous) => !previous);
			},
			closed: () => {
				const [getOpen] = store.state.open;
				return !getOpen();
			},
			isOpen: () => {
				const [getOpen] = store.state.open;
				return getOpen();
			},
			buttonLabel: () => {
				const [getOpen] = store.state.open;
				return getOpen() ? "Close Navigation" : "Open Navigation";
			},
			replaceChild: () => {
				const target = store.refs.get("testEleRefresh");
				if (target instanceof HTMLElement) {
					target.innerHTML =
						"<button data-store='testreplace' data-state--example='false' data-events--click='nav:@newClick' data-bind--testing='nav:$open'>after<span data-bind--test='$example'>children</span></button>";
				}
				if (target && !Array.isArray(target)) Catalyst.sync(target);
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
		},
		effects: {
			manual: {
				customEffect: (context) => {
					const [getOpen] = store.state.open;
					console.log("effect", getOpen(), context);
				},
			},
		},
		cleanup: () => {
			console.log("CLEANEDUP");
		},
	}),
});

export default navStore;
