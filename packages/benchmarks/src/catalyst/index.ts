import type { Suite } from "../suite.ts";
import { libraries } from "./libraries.ts";
import { scenarios } from "./scenarios.ts";

/**
 * Compares Catalyst with other libraries that add behaviour to HTML through
 * attributes. Each library has a page per fixture in `pages/{library}`,
 * written the way its own documentation recommends.
 */
const suite: Suite = {
	id: "catalyst",
	name: "Catalyst",
	libraries,
	scenarios,
	root: "#app",
	memory: {
		page: "rows",
		description:
			"The JavaScript heap of the rows page when it has loaded, and with 1,000 rows, after collecting garbage.",
		steps: [{ click: "#run" }],
	},
	size: {
		page: "rows",
		description:
			"The JavaScript the rows page loads: the library, the page's own code and its data, minified by Vite.",
	},
};

export default suite;
