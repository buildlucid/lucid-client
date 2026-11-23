import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import {
	allowConsoleErrors,
	catalystWarnings,
	setStoreState,
	settle,
} from "./utils.js";

describe("store effects", () => {
	it("run with the store, without registering a reaction", async () => {
		document.body.innerHTML = `<div data-store="effects"></div>`;

		const runs: Array<{
			value: number;
			isInitial: boolean;
			previous: number | undefined;
		}> = [];
		const effects = defineStore({
			state: { count: 0 },
			effects: ({ state, effect }) => ({
				log: effect(
					() => state.count,
					(value, { isInitial, previous }) => {
						runs.push({ value, isInitial, previous });
					},
				),
			}),
		});

		Catalyst.start({ stores: { effects } });
		expect(runs).toEqual([{ value: 0, isInitial: true, previous: undefined }]);

		setStoreState("effects", "count", 1);
		await settle();
		expect(runs).toEqual([
			{ value: 0, isInitial: true, previous: undefined },
			{ value: 1, isInitial: false, previous: 0 },
		]);
	});

	it("run after init and can call actions", async () => {
		document.body.innerHTML = `<div data-store="ordered"></div>`;

		const events: string[] = [];
		const ordered = defineStore({
			state: { open: false },
			actions: ({ setState }) => ({
				close: () => {
					events.push("close");
					setState((state) => {
						state.open = false;
					});
				},
			}),
			effects: ({ state, actions, effect }) => ({
				closeWhenOpened: effect(
					() => state.open,
					(open) => {
						events.push(`effect:${open}`);
						if (open) actions.close();
					},
				),
			}),
			init: ({ setState }) => {
				events.push("init");
				setState((state) => {
					state.open = true;
				});
			},
		});

		Catalyst.start({ stores: { ordered } });
		await settle();
		expect(events).toEqual(["init", "effect:true", "close", "effect:false"]);
	});

	it("run cleanups, stop with the store and isolate failing effects", async () => {
		allowConsoleErrors();
		document.body.innerHTML = `<div id="host" data-store="cleanups"></div>`;

		const cleanups: number[] = [];
		const runs: number[] = [];
		const cleanupsStore = defineStore({
			state: { count: 0 },
			effects: ({ state, effect }) => ({
				failing: effect(
					() => state.count,
					() => {
						throw new Error("effect failure");
					},
				),
				tracked: effect(
					() => state.count,
					(value) => {
						runs.push(value);
						return () => cleanups.push(value);
					},
				),
			}),
		});

		Catalyst.start({ stores: { cleanups: cleanupsStore } });
		setStoreState("cleanups", "count", 1);
		await settle();
		expect(runs).toEqual([0, 1]);
		expect(cleanups).toEqual([0]);

		// A throwing effect must not halt the rest of the reactive system.
		setStoreState("cleanups", "count", 2);
		await settle();
		expect(runs).toEqual([0, 1, 2]);

		document.querySelector("#host")?.remove();
		await settle();
		expect(cleanups).toEqual([0, 1, 2]);
	});

	it("warns about effects not created with the effect helper", () => {
		document.body.innerHTML = `<div data-store="invalid"></div>`;
		Catalyst.start({
			stores: {
				invalid: { effects: () => ({ broken: (() => {}) as never }) },
			},
		});
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('The effect "broken" on store "invalid"'),
		);
	});
});
