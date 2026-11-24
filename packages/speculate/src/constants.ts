import type { SpeculationTrigger } from "./types.js";

export default {
	/**
	 * Links follow the suite's `data-{namespace}--{specifier}` grammar: the action is the specifier and the trigger is the value
	 */
	attributes: {
		speculate: "data-speculate",
		prefetch: "data-speculate--prefetch",
		prerender: "data-speculate--prerender",
		/** Marks the speculation rules and prefetch links the library adds to `<head>`, so destroy can remove them */
		generated: "data-speculate--generated",
	},
	selector:
		"[data-speculate], [data-speculate--prefetch], [data-speculate--prerender]",
	triggers: [
		"visible",
		"immediate",
		"eager",
		"moderate",
		"conservative",
	] as ReadonlyArray<SpeculationTrigger>,
	/** The triggers that work without Speculation Rules. The others fall back to the default */
	fallbackTriggers: [
		"visible",
		"moderate",
	] as ReadonlyArray<SpeculationTrigger>,
	defaultTrigger: "moderate" as SpeculationTrigger,
	/** Matches Chrome's own hover delay for the `moderate` eagerness */
	defaultHoverDelay: 200,
};
