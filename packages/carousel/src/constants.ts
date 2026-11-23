export default {
	/**
	 * Every attribute follows the suite's `data-{namespace}--{specifier}` grammar, with `carousel` as the namespace
	 */
	attributes: {
		root: "data-carousel",
		track: "data-carousel--track",
		action: "data-carousel--action",
		marker: "data-carousel--marker",
		markers: "data-carousel--markers",
		status: "data-carousel--status",
		// Options, read from the root element
		loop: "data-carousel--loop",
		rewind: "data-carousel--rewind",
		autoplay: "data-carousel--autoplay",
		drag: "data-carousel--drag",
		inert: "data-carousel--inert",
		/** The prefix of the per carousel labels, such as `data-carousel--label-status` */
		label: "data-carousel--label",
		// State, written by the library
		ready: "data-carousel--ready",
		index: "data-carousel--index",
		count: "data-carousel--count",
		atStart: "data-carousel--at-start",
		atEnd: "data-carousel--at-end",
		scrollable: "data-carousel--scrollable",
		playing: "data-carousel--playing",
		dragging: "data-carousel--dragging",
		active: "data-carousel--active",
		visible: "data-carousel--visible",
	},
	actions: {
		prev: "prev",
		next: "next",
		toggle: "toggle",
		play: "play",
		pause: "pause",
	},
	properties: {
		index: "--carousel-index",
		count: "--carousel-count",
	},
	events: {
		change: "carousel-change",
	},
	/** Milliseconds between slides when `data-carousel--autoplay` has no value */
	autoplay: 5000,
	/** Pixels the pointer moves before a mouse press becomes a drag */
	dragThreshold: 5,
	/** Milliseconds without a scroll event before a scroll counts as finished, when `scrollend` can't be relied on */
	settleDelay: 200,
	labels: {
		carouselRole: "carousel",
		slideRole: "slide",
		slide: "{n} of {count}",
		marker: "Go to slide {n}",
		status: "Slide {n} of {count}",
		play: "Start automatic slide show",
		pause: "Stop automatic slide show",
	},
} as const;
