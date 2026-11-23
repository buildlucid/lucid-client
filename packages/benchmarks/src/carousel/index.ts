import type { Suite } from "../suite.ts";
import { libraries } from "./libraries.ts";
import { scenarios } from "./scenarios.ts";
import { verifySlides } from "./verify.ts";

/**
 * Compares Lucid Carousel with popular carousels that move slides with
 * transforms, and with ones that scroll them with CSS scroll snapping. Each
 * library has a page per fixture in `pages/{library}`, written the way its own
 * documentation recommends. Their markup differs, so the output check
 * confirms each carousel shows the right slide rather than comparing DOM.
 */
const suite: Suite = {
	id: "carousel",
	name: "Carousel",
	libraries,
	scenarios,
	root: "#app",
	verify: verifySlides,
	memory: {
		page: "start-up",
		description:
			"The JavaScript heap of the start-up page when it has loaded, and once its 20 carousels have started, after collecting garbage.",
		steps: [{ call: "render" }, { call: "start" }, { wait: 1000 }],
	},
	size: {
		page: "navigation",
		description:
			"What the page with one carousel loads: the library, the page's own code, and the CSS the library needs, minified by Vite.",
	},
};

export default suite;
