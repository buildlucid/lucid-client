import type { Page } from "playwright";

/**
 * One thing a sample does: click an element, call a function the page exposes
 * with `defineHarness`, type a value into a field, wait, or resize the
 * browser window.
 */
export type Step =
	| { click: string }
	| { call: string; args?: unknown[] }
	| { input: string; value: string }
	| { wait: number }
	| { resize: { width: number; height: number } };

export type Scenario = {
	id: string;
	name: string;
	description: string;
	/** Library features the scenario exercises. */
	features: string[];
	/** The page every library renders for this scenario, such as `rows`. */
	page: string;
	/** Steps run several times before timing, so the timed step runs warm. */
	warmup: Step[];
	/** How many times the warm-up steps run. Defaults to the runner's 5. */
	warmups?: number;
	/** Steps run once after warming up, to put the page in its starting state. */
	setup: Step[];
	/** The step that is timed. */
	timed: Step;
	/**
	 * What is measured:
	 * - `time`, the default: from the step until the library's work and the
	 *   browser's style and layout are done, in one task.
	 * - `work`: all the scripting, style and layout work from the step until
	 *   `settleMs` has passed, for work spread over many frames, such as an
	 *   animation, scroll events or observers.
	 */
	metric?: "time" | "work";
	/** How long `work` keeps measuring after the step. */
	settleMs?: number;
	/**
	 * Steps the output check runs after the timed step, to confirm the page
	 * works as well as renders, such as clicking a button it set up.
	 */
	check?: Step[];
	/**
	 * The timed step must keep every element that was rendered before it, as a
	 * keyed update does, rather than render them again. The output check
	 * confirms it.
	 */
	keepsElements?: boolean;
	/** What a suite's own `verify` expects after the check, such as the slide in view. */
	expected?: unknown;
	/**
	 * Whether a failed `verify` stops the run, which it does by default. When
	 * the scenario also shows what libraries get wrong, such as which slide a
	 * resize ends on, `false` records the problem in the results instead.
	 */
	strict?: boolean;
};

export type Library = {
	id: string;
	name: string;
	/** The npm package, for the version and link. `null` for hand-written code. */
	package: string | null;
	homepage: string | null;
	/** How the library works, for the results page, such as "CSS scroll snap". */
	kind?: string;
};

/**
 * A set of scenarios comparing one Lucid Client library with others. Each
 * library has a page per fixture at `src/{suite}/pages/{library}/{page}.html`.
 */
export type Suite = {
	id: string;
	name: string;
	/** The first library's output is the reference the others are checked against. */
	libraries: Library[];
	scenarios: Scenario[];
	/** The element every library must render the same DOM inside. */
	root: string;
	/**
	 * Checks a library's output after a scenario's check steps, instead of
	 * comparing its DOM with the first library's. For libraries that render
	 * different DOM for the same result, such as carousels. Returns a problem,
	 * or `null`.
	 */
	verify?: (page: Page, scenario: Scenario) => Promise<string | null>;
	/** Heap size is measured when the page loads, and again after `steps`. */
	memory: { page: string; description: string; steps: Step[] };
	/** The page whose JavaScript and CSS are weighed for each library. */
	size: { page: string; description: string };
};
