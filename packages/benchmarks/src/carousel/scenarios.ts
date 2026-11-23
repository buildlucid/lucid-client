import type { Scenario, Step } from "../suite.ts";
import type { ExpectedSlides } from "./verify.ts";

/** The first carousel's previous and next buttons. */
const next: Step = { click: "[data-bench-next]" };
const prev: Step = { click: "[data-bench-prev]" };

/** Long enough for any library's slide animation or smooth scroll to finish. */
const SETTLE = 1000;

/** Warms up the navigation code before timing, waiting out each move. */
const navigate: Step[] = [next, { wait: SETTLE }, prev, { wait: SETTLE }];

const expect = (...slides: ExpectedSlides): ExpectedSlides => slides;

/**
 * What the carousel suite measures. Carousels spread their work over many
 * frames, observers and scroll events, so every scenario measures all the
 * main thread's work from the step until the page has settled, not only the
 * task the step ran in.
 */
export const scenarios: Scenario[] = [
	{
		id: "start-up",
		name: "Start-up",
		description:
			"Starts 20 carousels of 10 slides on a page that has rendered their markup. Each has previous and next buttons and a dot for each slide.",
		features: ["Setup", "Measuring", "Markers", "Accessibility"],
		page: "start-up",
		warmup: [],
		setup: [{ call: "render" }],
		timed: { call: "start" },
		metric: "work",
		settleMs: SETTLE,
		check: [next, { wait: SETTLE }],
		expected: expect({ carousel: 0, slide: 1 }, { carousel: 19, slide: 0 }),
	},
	{
		id: "large",
		name: "Large carousel",
		description:
			"Starts one carousel of 300 slides, with previous and next buttons.",
		features: ["Setup", "Measuring"],
		page: "large",
		warmup: [],
		setup: [{ call: "render" }],
		timed: { call: "start" },
		metric: "work",
		settleMs: SETTLE,
		check: [next, { wait: SETTLE }],
		expected: expect({ carousel: 0, slide: 1 }),
	},
	{
		id: "next-slide",
		name: "Next slide",
		description:
			"Clicks Next, and measures the work while the carousel moves to its second slide and settles.",
		features: ["Navigation", "Animation"],
		page: "navigation",
		warmup: navigate,
		warmups: 2,
		setup: [],
		timed: next,
		metric: "work",
		settleMs: SETTLE,
		expected: expect({ carousel: 0, slide: 1 }),
	},
	{
		id: "go-to-slide",
		name: "Go to a slide",
		description:
			"Clicks the 8th dot, moving seven slides at once, and measures the work until the carousel settles.",
		features: ["Markers", "Navigation", "Animation"],
		page: "navigation",
		warmup: navigate,
		warmups: 2,
		setup: [],
		timed: { call: "dot", args: [7] },
		metric: "work",
		settleMs: SETTLE,
		expected: expect({ carousel: 0, slide: 7 }),
	},
	{
		id: "resize",
		name: "Resize",
		description:
			"Narrows the window from 1,280 to 900 pixels while the carousel shows its 4th slide, and measures the work to lay it out again on the same slide.",
		features: ["Measuring", "Resize"],
		page: "navigation",
		warmup: [],
		setup: [{ call: "dot", args: [3] }, { wait: SETTLE }],
		timed: { resize: { width: 900, height: 720 } },
		metric: "work",
		settleMs: SETTLE,
		expected: expect({ carousel: 0, slide: 3 }),
		// Libraries that end up on another slide are still measured, and the results say so.
		strict: false,
	},
];
