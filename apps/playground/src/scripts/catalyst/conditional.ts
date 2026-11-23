import { defineStore } from "@lucidclient/catalyst";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("conditional");

let renders = 0;
const toggle = defineStore({
	state: { shown: true },
	computed: ({ state }) => ({
		hidden: () => !state.shown,
		label: () => (state.shown ? "Hide both" : "Show both"),
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.shown = !state.shown;
			}),
		renderStamp: () => {
			renders += 1;
			return renders;
		},
	}),
});

const account = defineStore({
	state: { business: false, submitted: "Not submitted yet" },
	actions: ({ setState }) => ({
		submit: (event: SubmitEvent) => {
			const form = event.target as HTMLFormElement;
			const data = Object.fromEntries(new FormData(form));
			setState((state) => {
				state.submitted = JSON.stringify(data, null, 2);
			});
			log.info("Submitted", data);
		},
	}),
});

const timerHost = defineStore({
	state: { running: false },
	computed: ({ state }) => ({
		label: () => (state.running ? "Stop timer" : "Start timer"),
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.running = !state.running;
			}),
	}),
});

const timer = defineStore({
	state: { seconds: 0 },
	init: ({ setState }) => {
		log.info("timer store created");
		const interval = setInterval(() => {
			setState((state) => {
				state.seconds += 1;
			});
		}, 1000);
		return () => {
			clearInterval(interval);
			log.success("timer cleanup ran");
		};
	},
});

type Task = { title: string; notes: string; expanded: boolean };

const tasks = defineStore({
	state: {
		tasks: [
			{
				title: "Write the docs",
				notes: "Cover data-if and its template.",
				expanded: false,
			},
			{
				title: "Add tests",
				notes: "Rendering, disposal and loops.",
				expanded: false,
			},
			{ title: "Ship it", notes: "After review.", expanded: false },
		] as Task[],
	},
	actions: ({ setState }) => ({
		toggle: (_event: Event, { item }: LoopItem<Task>) =>
			setState(() => {
				item.expanded = !item.expanded;
			}),
	}),
});

const placeholder = defineStore({
	state: { ready: false },
	actions: ({ setState }) => ({
		markReady: () =>
			setState((state) => {
				state.ready = true;
			}),
	}),
});

startCatalyst({
	stores: { toggle, account, timerHost, timer, tasks, placeholder },
});
