import { defineStore } from "@lucidclient/catalyst";
import { initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

// --------------------------------------------------------
// Data attributes from state

const dataAttribute = defineStore({
	state: { storeState: 69 },
	actions: ({ setState }) => ({
		incrementStoreState: () =>
			setState((state) => {
				state.storeState += 1;
			}),
	}),
});

// --------------------------------------------------------
// Boolean attributes

const booleans = defineStore({
	state: { disabled: false, required: false, readonly: false, open: false },
	actions: ({ setState }) => ({
		toggleDisabled: () =>
			setState((state) => {
				state.disabled = !state.disabled;
			}),
		toggleRequired: () =>
			setState((state) => {
				state.required = !state.required;
			}),
		toggleReadonly: () =>
			setState((state) => {
				state.readonly = !state.readonly;
			}),
		toggleOpen: () =>
			setState((state) => {
				state.open = !state.open;
			}),
	}),
});

// --------------------------------------------------------
// aria-*, data-* and enumerated attributes

const enumerated = defineStore({
	state: { expanded: false, editable: false, draggable: false },
	actions: ({ setState }) => ({
		toggleExpanded: () =>
			setState((state) => {
				state.expanded = !state.expanded;
			}),
		toggleEditable: () =>
			setState((state) => {
				state.editable = !state.editable;
			}),
		toggleDraggable: () =>
			setState((state) => {
				state.draggable = !state.draggable;
			}),
	}),
});

// --------------------------------------------------------
// Nullish and falsy values

const valuesLog = createLogger("values");
const VALUES: Record<string, unknown> = {
	text: "some text",
	empty: "",
	zero: 0,
	false: false,
	true: true,
	null: null,
	undefined: undefined,
};

const nullish = defineStore({
	state: { value: "some text" as unknown },
	actions: ({ setState }) => ({
		setValue: (event: Event) => {
			const name =
				event.currentTarget instanceof HTMLElement
					? (event.currentTarget.dataset.valueName ?? "text")
					: "text";
			const next = VALUES[name];
			setState((state) => {
				state.value = next;
			});
			valuesLog.info(`value = ${name}`);
		},
	}),
});

// --------------------------------------------------------
// Nested paths

const paths = defineStore({
	state: {
		links: [
			{ title: "Home", url: "/" },
			{ title: "Docs", url: "/docs" },
		],
		object: { hello: "world", world: "hello" },
		array: [false, "world"] as (boolean | string)[],
	},
	actions: ({ setState }) => ({
		changeFirstUrl: () =>
			setState((state) => {
				const first = state.links[0];
				if (first) first.url = first.url === "/" ? "/home" : "/";
			}),
		swapObject: () =>
			setState((state) => {
				const { hello, world } = state.object;
				state.object.hello = world;
				state.object.world = hello;
			}),
		flipArray: () =>
			setState((state) => {
				state.array[0] = !state.array[0];
			}),
	}),
});

// --------------------------------------------------------
// SVG attributes

const svg = defineStore({
	state: { zoom: 1, hue: 277 },
	computed: ({ state }) => ({
		viewBox: () => {
			const size = 100 / state.zoom;
			const offset = (100 - size) / 2;
			return `${offset} ${offset} ${size} ${size}`;
		},
		fill: () => `oklch(0.76 0.12 ${state.hue})`,
		zoomLabel: () => `${state.zoom}×`,
	}),
	actions: ({ setState }) => ({
		zoomIn: () =>
			setState((state) => {
				state.zoom = state.zoom >= 4 ? 1 : state.zoom * 2;
			}),
		shiftHue: () =>
			setState((state) => {
				state.hue = (state.hue + 60) % 360;
			}),
	}),
});

// --------------------------------------------------------
// Objects, computed values and actions

const derived = defineStore({
	state: {
		progress: 40,
		filters: { category: "all", tags: [] as string[] },
	},
	computed: ({ state }) => ({
		barStyle: () => `width: ${state.progress}%`,
	}),
	actions: ({ state, setState }) => ({
		advance: () =>
			setState((draft) => {
				draft.progress = draft.progress >= 100 ? 0 : draft.progress + 20;
			}),
		toggleCategory: () =>
			setState((draft) => {
				draft.filters.category =
					draft.filters.category === "all" ? "news" : "all";
			}),
		addTag: () =>
			setState((draft) => {
				draft.filters.tags.push(`t${draft.filters.tags.length + 1}`);
			}),
		describeProgress: () => `${state.progress} percent complete`,
	}),
});

// --------------------------------------------------------
// Misconfigured bindings

const misconfigured = defineStore({
	state: { label: "A label" },
});

initCatalyst({
	stores: {
		dataAttribute,
		booleans,
		enumerated,
		nullish,
		paths,
		svg,
		derived,
		misconfigured,
	},
});
