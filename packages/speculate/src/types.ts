/**
 * What happens to a link's page
 * - prefetch: its document is downloaded, so it loads quicker
 * - prerender: it is loaded and rendered in the background, so it shows straight away. Needs Speculation Rules
 */
export type SpeculationAction = "prefetch" | "prerender";

/**
 * When a link's page is speculated
 * - visible: once the link scrolls into view
 * - immediate, eager, moderate, conservative: Speculation Rules' eagerness levels. Without Speculation Rules, they all work like `moderate`
 */
export type SpeculationTrigger =
	| "visible"
	| "immediate"
	| "eager"
	| "moderate"
	| "conservative";

export type Options = {
	/**
	 * How long the pointer rests on a `moderate` link before it is prefetched, in milliseconds
	 * - Only used without Speculation Rules, as browsers that support them wait for their own hover
	 * @default 200
	 */
	hoverDelay?: number;
};

/** A link's action and trigger, read from its attributes */
export type LinkConfig = {
	action: SpeculationAction;
	trigger: SpeculationTrigger;
};

/** A link to speculate: its action, trigger and URL */
export type Speculation = LinkConfig & {
	url: URL;
};

/** What the browser supports, which decides how links are speculated */
export type Support = {
	rules: boolean;
	linkPrefetch: boolean;
};
