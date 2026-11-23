import type { Scenario, Step } from "../suite.ts";

const run: Step = { click: "#run" };
const row = (position: number, button: "select" | "remove"): Step => ({
	click: `tbody tr:nth-of-type(${position}) .${button}`,
});

/**
 * What the Catalyst suite measures. The row scenarios are the operations
 * js-framework-benchmark times, so the numbers are familiar. The others cover
 * what Catalyst is for: enhancing server-rendered markup, forms and markup
 * added after the page loads.
 */
export const scenarios: Scenario[] = [
	{
		id: "start-up",
		name: "Start-up",
		description:
			"Starts the library on a page with 250 server-rendered cards. Each card has its own state, a toggle and a like button.",
		features: ["Stores", "State attributes", "Computed values", "Bindings"],
		page: "start-up",
		warmup: [],
		setup: [{ call: "render" }],
		timed: { call: "start" },
		check: [
			{ click: "article:nth-of-type(1) .toggle" },
			{ click: "article:nth-of-type(2) .like" },
		],
	},
	{
		id: "create-rows",
		name: "Create rows",
		description: "Renders 1,000 rows into an empty table.",
		features: ["Loops", "Bindings", "Events"],
		page: "rows",
		warmup: [run, { click: "#clear" }],
		setup: [],
		timed: run,
	},
	{
		id: "replace-rows",
		name: "Replace rows",
		description: "Replaces all 1,000 rows with new ones.",
		features: ["Loops"],
		page: "rows",
		warmup: [run],
		setup: [run],
		timed: run,
	},
	{
		id: "partial-update",
		name: "Partial update",
		description: "Changes the label of every 10th row in a table of 1,000.",
		features: ["Nested state", "Fine-grained updates"],
		page: "rows",
		warmup: [run, { click: "#update" }],
		setup: [run],
		timed: { click: "#update" },
		keepsElements: true,
	},
	{
		id: "select-row",
		name: "Select row",
		description:
			"Highlights the row that was clicked in a table of 1,000, and stops highlighting the row selected before it, by binding each row's class.",
		features: ["Bindings", "Loop items in actions"],
		page: "rows",
		warmup: [run, row(5, "select")],
		setup: [run, row(5, "select")],
		timed: row(2, "select"),
		keepsElements: true,
	},
	{
		id: "swap-rows",
		name: "Swap rows",
		description: "Swaps the 2nd and 999th rows in a table of 1,000.",
		features: ["Loops", "Reusing items"],
		page: "rows",
		warmup: [run, { click: "#swap" }],
		setup: [run],
		timed: { click: "#swap" },
		keepsElements: true,
	},
	{
		id: "remove-row",
		name: "Remove row",
		description:
			"Removes the row whose button was clicked from a table of 1,000.",
		features: ["Loops", "Loop items in actions", "Cleanup"],
		page: "rows",
		warmup: [run, row(5, "remove")],
		setup: [run],
		timed: row(4, "remove"),
	},
	{
		id: "append-rows",
		name: "Append rows",
		description: "Adds 1,000 rows to a table of 1,000.",
		features: ["Loops"],
		page: "rows",
		warmup: [run, { click: "#add" }],
		setup: [run],
		timed: { click: "#add" },
		keepsElements: true,
	},
	{
		id: "clear-rows",
		name: "Clear rows",
		description:
			"Removes all 1,000 rows, and cleans up their bindings and listeners.",
		features: ["Loops", "Cleanup"],
		page: "rows",
		warmup: [run, { click: "#clear" }],
		setup: [run],
		timed: { click: "#clear" },
	},
	{
		id: "live-search",
		name: "Live search",
		description:
			"Types into a search box that filters a list of 1,000 items down to 122, with a count of the matches.",
		features: ["Two-way binding", "Computed values", "Loops"],
		page: "search",
		warmup: [
			{ input: "input", value: "blue" },
			{ input: "input", value: "" },
		],
		setup: [],
		timed: { input: "input", value: "red" },
	},
	{
		id: "dynamic-markup",
		name: "Dynamic markup",
		description:
			"Inserts 100 cards into a running page, as markup fetched from a server would be, and sets them up.",
		features: ["Syncing markup", "Stores", "Bindings", "Events"],
		page: "markup",
		warmup: [{ call: "insert" }, { call: "clear" }],
		setup: [],
		timed: { call: "insert" },
		check: [
			{ click: "article:nth-of-type(1) .toggle" },
			{ click: "article:nth-of-type(2) .like" },
		],
	},
];
