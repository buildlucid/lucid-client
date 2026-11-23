import { defineStore } from "@lucidclient/catalyst";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

type Link = { title: string; url: string };

// --------------------------------------------------------
// Rendering an array from state

const basic = defineStore({
	state: {
		label: "from the store",
		links: [
			{ title: "Overview", url: "/" },
			{ title: "Stores", url: "/catalyst/stores" },
			{ title: "Loops", url: "/catalyst/loops" },
		] as Link[],
	},
	computed: ({ state }) => ({
		total: () => state.links.length,
	}),
	actions: ({ setState }) => {
		let added = 0;
		return {
			push: () =>
				setState((state) => {
					added += 1;
					state.links.push({ title: `Added ${added}`, url: `#added-${added}` });
				}),
			pop: () =>
				setState((state) => {
					state.links.pop();
				}),
			renameFirst: () =>
				setState((state) => {
					const first = state.links[0];
					if (!first) return;
					first.title = first.title.endsWith(" (renamed)")
						? first.title.replace(" (renamed)", "")
						: `${first.title} (renamed)`;
				}),
		};
	},
});

// --------------------------------------------------------
// Looping over an action

const filtered = defineStore({
	state: {
		onlyEven: false,
		numbers: [1, 2, 3, 4, 5, 6],
	},
	computed: ({ state }) => ({
		filterLabel: () => (state.onlyEven ? "Show all" : "Only even"),
	}),
	actions: ({ state, setState }) => ({
		visibleNumbers: () =>
			state.numbers.filter((value) => !state.onlyEven || value % 2 === 0),
		toggleFilter: () =>
			setState((draft) => {
				draft.onlyEven = !draft.onlyEven;
			}),
		addNumber: () =>
			setState((draft) => {
				draft.numbers.push(draft.numbers.length + 1);
			}),
	}),
});

// --------------------------------------------------------
// Identity reuse

type Person = { id: number; name: string };

const people = (): Person[] => [
	{ id: 1, name: "Ada" },
	{ id: 2, name: "Grace" },
	{ id: 3, name: "Linus" },
	{ id: 4, name: "Margaret" },
	{ id: 5, name: "Alan" },
];

const identityLog = createLogger("identity");
let renders = 0;
let nextId = 6;

const identity = defineStore({
	state: { rows: people() as Person[] | null },
	computed: ({ state }) => ({
		count: () => state.rows?.length ?? 0,
	}),
	actions: ({ state, setState }) => ({
		// Each rendered row calls this once, when its directive is set up, so the
		// number only changes when a row is rendered again.
		renderStamp: () => {
			renders += 1;
			return `#${renders}`;
		},
		shuffle: () =>
			setState((draft) => {
				if (!draft.rows) return;
				const rows = [...draft.rows];
				for (let index = rows.length - 1; index > 0; index -= 1) {
					const swap = Math.floor(Math.random() * (index + 1));
					[rows[index], rows[swap]] = [rows[swap]!, rows[index]!];
				}
				draft.rows = rows;
			}),
		reverse: () =>
			setState((draft) => {
				if (draft.rows) draft.rows = [...draft.rows].reverse();
			}),
		removeMiddle: () =>
			setState((draft) => {
				if (!draft.rows?.length) return;
				draft.rows.splice(Math.floor(draft.rows.length / 2), 1);
			}),
		prepend: () =>
			setState((draft) => {
				draft.rows ??= [];
				draft.rows.unshift({ id: nextId, name: `New ${nextId}` });
				nextId += 1;
			}),
		replaceWithCopies: () => {
			// Fresh objects with the same data, as if parsed from JSON again.
			const copies = JSON.parse(JSON.stringify(state.rows ?? [])) as Person[];
			setState((draft) => {
				draft.rows = copies;
			});
			identityLog.info("Replaced every row with a fresh copy");
		},
		clear: () =>
			setState((draft) => {
				draft.rows = null;
			}),
		restore: () =>
			setState((draft) => {
				draft.rows = people();
			}),
	}),
});

// --------------------------------------------------------
// Nested loops and $parent

type Group = {
	title: string;
	sections: Array<{ title: string; links: string[] }>;
};

const nested = defineStore({
	state: {
		groups: [
			{
				title: "Catalyst",
				sections: [
					{ title: "Core", links: ["Stores", "State attributes"] },
					{ title: "Reactions", links: ["Bindings", "Loops"] },
				],
			},
			{
				title: "Speculate",
				sections: [{ title: "Links", links: ["Prefetch", "Prerender"] }],
			},
		] as Group[],
	},
	actions: ({ setState }) => {
		let added = 0;
		return {
			addLink: () =>
				setState((state) => {
					added += 1;
					state.groups[0]?.sections[0]?.links.push(`Added ${added}`);
				}),
			addGroup: () =>
				setState((state) => {
					state.groups.push({
						title: `Group ${state.groups.length + 1}`,
						sections: [{ title: "Only section", links: ["First link"] }],
					});
				}),
		};
	},
});

// --------------------------------------------------------
// Actions inside loop items

const itemLog = createLogger("item actions");

/** Loop item actions only receive the event, so the index comes from markup. */
const indexFrom = (event: Event) => {
	const target = event.currentTarget;
	if (!(target instanceof HTMLElement)) return -1;
	return Number(target.dataset.index ?? -1);
};

const tasks = defineStore({
	state: {
		tasks: [
			{ title: "Write the forms page", votes: 2 },
			{ title: "Fix the checked gap", votes: 0 },
			{ title: "Ship 0.6.0", votes: 5 },
		],
	},
	actions: ({ state, setState }) => ({
		vote: (event: Event) => {
			const index = indexFrom(event);
			setState((draft) => {
				const task = draft.tasks[index];
				if (task) task.votes += 1;
			});
			itemLog.info(`vote received index ${index}`, {
				arguments: "only the Event",
				title: state.tasks[index]?.title,
			});
		},
		remove: (event: Event) => {
			const index = indexFrom(event);
			itemLog.info(`remove received index ${index}`, state.tasks[index]?.title);
			setState((draft) => {
				draft.tasks.splice(index, 1);
			});
		},
	}),
});

// --------------------------------------------------------
// Primitive items

const tags = defineStore({
	state: { tags: ["alpha", "beta", "beta", "gamma"] },
	actions: ({ setState }) => ({
		addBeta: () =>
			setState((state) => {
				state.tags.push("beta");
			}),
		removeFirstBeta: () =>
			setState((state) => {
				const index = state.tags.indexOf("beta");
				if (index !== -1) state.tags.splice(index, 1);
			}),
		sort: () =>
			setState((state) => {
				state.tags = [...state.tags].sort();
			}),
	}),
});

// --------------------------------------------------------
// Placeholders and late data

const loadLog = createLogger("late data");
const late = defineStore({
	state: {
		loading: true,
		results: null as string[] | null,
	},
	computed: ({ state }) => ({
		ready: () => !state.loading,
	}),
	actions: ({ setState }) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		return {
			load: () => {
				clearTimeout(timer);
				setState((state) => {
					state.loading = true;
					state.results = null;
				});
				timer = setTimeout(() => {
					setState((state) => {
						state.loading = false;
						state.results = ["First result", "Second result", "Third result"];
					});
					loadLog.success("Results arrived");
				}, 1200);
			},
			cancel: () => clearTimeout(timer),
		};
	},
	init: ({ actions }) => {
		actions.load();
		return actions.cancel;
	},
});

const server = defineStore({
	state: {
		items: ["Client item one", "Client item two"],
	},
});

// --------------------------------------------------------
// Misconfigured loops

const misconfigured = defineStore({
	state: {
		notAnArray: "a string",
		items: [1, 2],
	},
});

startCatalyst({
	stores: {
		basic,
		filtered,
		identity,
		nested,
		tasks,
		tags,
		late,
		server,
		misconfigured,
	},
});
