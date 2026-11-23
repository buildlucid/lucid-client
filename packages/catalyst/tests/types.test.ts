import { describe, expectTypeOf, it } from "vite-plus/test";
import Catalyst, { defineStore, persisted } from "../src/index.js";

/**
 * These checks run when the tests are type-checked (`vp lint`). The runtime
 * test only makes sure the definitions are valid store definitions.
 */
describe("defineStore types", () => {
	it("infers state, computed values, actions and effect values", () => {
		type Link = { title: string; url: string };

		const nav = defineStore({
			state: { open: false, links: [] as Link[] },
			computed: ({ state }) => {
				expectTypeOf(state.open).toEqualTypeOf<boolean>();
				return {
					label: () => (state.open ? "Close" : "Open"),
					count: () => state.links.length,
				};
			},
			actions: ({ state, setState, refs }) => {
				expectTypeOf(state.label).toEqualTypeOf<string>();
				expectTypeOf(state.count).toEqualTypeOf<number>();
				expectTypeOf(refs.get("search")).toEqualTypeOf<
					HTMLElement | undefined
				>();
				expectTypeOf(refs.get<HTMLInputElement>("search")).toEqualTypeOf<
					HTMLInputElement | undefined
				>();
				expectTypeOf(refs.all<HTMLInputElement>("fields")).toEqualTypeOf<
					HTMLInputElement[]
				>();
				return {
					toggle: () =>
						setState((draft) => {
							draft.open = !draft.open;
						}),
					add: (link: Link) =>
						setState((draft) => {
							draft.links.push(link);
						}),
					onClick: (event: MouseEvent) => event.button,
				};
			},
			effects: ({ state, actions, effect }) => {
				expectTypeOf(actions.add).parameters.toEqualTypeOf<[Link]>();
				return {
					log: effect(
						() => state.open,
						(open, { previous }) => {
							expectTypeOf(open).toEqualTypeOf<boolean>();
							expectTypeOf(previous).toEqualTypeOf<boolean | undefined>();
						},
					),
					count: effect(
						() => state.links.length,
						(count) => {
							expectTypeOf(count).toEqualTypeOf<number>();
							return () => {};
						},
					),
				};
			},
			init: ({ state, actions }) => {
				expectTypeOf(state.label).toEqualTypeOf<string>();
				expectTypeOf(actions.toggle).returns.toEqualTypeOf<void>();
				return () => {};
			},
		});

		const factory = defineStore({
			state: () => ({ count: 0 }),
			actions: ({ state, setState }) => {
				expectTypeOf(state.count).toEqualTypeOf<number>();
				return {
					increment: () =>
						setState((draft) => {
							draft.count += 1;
						}),
				};
			},
		});

		const empty = defineStore({});

		expectTypeOf(Catalyst.start).toBeCallableWith({
			stores: { nav, factory, empty, alias: nav },
		});
	});

	it("unwraps persisted state values", () => {
		type Theme = "light" | "dark";
		type User = { name: string };

		const prefs = defineStore({
			state: {
				theme: persisted("light" as Theme, {
					storage: "session",
					key: "theme",
					sync: true,
					validate: (value) => value === "light" || value === "dark",
				}),
				open: persisted(false),
				label: persisted("Menu"),
				user: persisted(null as User | null),
				busy: false,
			},
			computed: ({ state }) => {
				expectTypeOf(state.theme).toEqualTypeOf<Theme>();
				return { isDark: () => state.theme === "dark" };
			},
			actions: ({ state, setState }) => {
				expectTypeOf(state.open).toEqualTypeOf<boolean>();
				expectTypeOf(state.label).toEqualTypeOf<string>();
				expectTypeOf(state.user).toEqualTypeOf<User | null>();
				expectTypeOf(state.busy).toEqualTypeOf<boolean>();
				expectTypeOf(state.isDark).toEqualTypeOf<boolean>();
				return {
					toggle: () =>
						setState((draft) => {
							draft.theme = draft.theme === "dark" ? "light" : "dark";
							// @ts-expect-error theme is a Theme
							draft.theme = "blue";
						}),
				};
			},
			init: ({ state }) => {
				expectTypeOf(state.theme).toEqualTypeOf<Theme>();
			},
		});

		const factory = defineStore({
			state: () => ({ items: persisted([] as string[]) }),
			effects: ({ state, effect }) => ({
				count: effect(
					() => state.items,
					(items) => {
						expectTypeOf(items).toEqualTypeOf<string[]>();
					},
				),
			}),
		});

		expectTypeOf(Catalyst.start).toBeCallableWith({
			stores: { prefs, factory },
			attributes: { persist: "save" },
			persistence: {
				prefix: "site:",
				storage: "session",
				sync: true,
				adapters: {
					memory: {
						get: () => undefined,
						set: () => {},
						remove: () => {},
					},
				},
			},
		});
		expectTypeOf(Catalyst.clearPersisted).toBeCallableWith("prefs");
		expectTypeOf(Catalyst.clearPersisted).toBeCallableWith();
	});

	it("rejects writes and wrong types", () => {
		defineStore({
			state: { open: false, count: 0 },
			computed: ({ state }) => ({ label: () => String(state.open) }),
			actions: ({ state, setState }) => ({
				direct: () => {
					// @ts-expect-error state is read-only, write through setState
					state.open = true;
				},
				computed: () => {
					// @ts-expect-error computed values can't be written
					state.label = "label";
				},
				unknown: () =>
					setState((draft) => {
						// @ts-expect-error not a state key
						draft.missing = 1;
					}),
				wrongType: () =>
					setState((draft) => {
						// @ts-expect-error count is a number
						draft.count = "1";
					}),
			}),
			effects: ({ state, effect }) => ({
				mismatch: effect(
					// @ts-expect-error the callback expects a string, not a boolean
					() => state.open,
					(value: string) => value,
				),
			}),
		});
	});
});
