/**
 * One thing a sample does in the page: click an element, call a function the
 * page exposes with `defineHarness`, or type a value into a field.
 */
export type Step =
	| { click: string }
	| { call: string }
	| { input: string; value: string };

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
	/** Steps run once after warming up, to put the page in its starting state. */
	setup: Step[];
	/** The step that is timed. */
	timed: Step;
	/**
	 * Steps the output check runs after the timed step, to confirm the page
	 * works as well as renders, such as clicking a button it set up.
	 */
	check?: Step[];
};

export type Library = {
	id: string;
	name: string;
	/** The npm package, for the version and link. `null` for hand-written code. */
	package: string | null;
	homepage: string | null;
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
	/** Heap size is measured when the page loads, and again after `steps`. */
	memory: { page: string; description: string; steps: Step[] };
	/** The page whose JavaScript is weighed for each library. */
	size: { page: string; description: string };
};
