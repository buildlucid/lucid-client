import { describe, expect, it } from "vite-plus/test";
import Catalyst, {
	createSignal,
	defineEffect,
	storeModule,
} from "../src/index.js";
import { effects } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { allowConsoleErrors, settle } from "./utils.js";

describe("effects reaction", () => {
	it("runs global and deduplicated manual effects", async () => {
		document.body.innerHTML = `
			<div data-store="effects" data-state--count="0">
				<div data-effects="#manual"></div>
				<div data-effects="#manual"></div>
			</div>
		`;

		const globalRuns: Array<{ value: number; isInitial: boolean }> = [];
		const manualRuns: Array<{
			value: number;
			isInitial: boolean;
			previous: number | undefined;
		}> = [];
		storeModule("effects", {
			state: () => ({ count: createSignal(0) }),
			setup: (store) => ({
				actions: {},
				effects: {
					global: {
						global: {
							compute: () => store.state.count[0](),
							effect: (value, { isInitial }) => {
								globalRuns.push({ value, isInitial });
							},
						},
					},
					manual: {
						manual: defineEffect({
							compute: () => store.state.count[0](),
							effect: (value, { isInitial, previous }) => {
								manualRuns.push({ value, isInitial, previous });
							},
						}),
					},
				},
			}),
		});

		Catalyst.start({ reactions: [effects] });
		expect(globalRuns).toEqual([{ value: 0, isInitial: true }]);
		expect(manualRuns).toEqual([
			{ value: 0, isInitial: true, previous: undefined },
		]);

		Runtime.stores.get("effects")?.state.count?.[1](1);
		await settle();
		expect(globalRuns.at(-1)).toEqual({ value: 1, isInitial: false });
		expect(manualRuns).toEqual([
			{ value: 0, isInitial: true, previous: undefined },
			{ value: 1, isInitial: false, previous: 0 },
		]);
	});

	it("runs effect cleanups and isolates failing effects", async () => {
		allowConsoleErrors();
		document.body.innerHTML = `
			<div data-store="cleanups">
				<div id="host" data-effects="#tracked"></div>
				<div data-effects="#failing"></div>
			</div>
		`;

		const cleanups: number[] = [];
		const runs: number[] = [];
		let setCount: ((value: number) => void) | undefined;
		storeModule("cleanups", {
			state: () => {
				const count = createSignal(0);
				setCount = (value) => count[1](value);
				return { count };
			},
			setup: (store) => ({
				actions: {},
				effects: {
					manual: {
						tracked: {
							compute: () => store.state.count[0](),
							effect: (value) => {
								runs.push(value);
								return () => cleanups.push(value);
							},
						},
						failing: {
							compute: () => store.state.count[0](),
							effect: () => {
								throw new Error("effect failure");
							},
						},
					},
				},
			}),
		});

		Catalyst.start({ reactions: [effects] });
		setCount?.(1);
		await settle();
		expect(runs).toEqual([0, 1]);
		expect(cleanups).toEqual([0]);

		document.querySelector("#host")?.remove();
		await settle();
		expect(cleanups).toEqual([0, 1]);

		// A throwing effect must not halt the rest of the reactive system.
		setCount?.(2);
		await settle();
		expect(runs).toEqual([0, 1]);
	});
});
