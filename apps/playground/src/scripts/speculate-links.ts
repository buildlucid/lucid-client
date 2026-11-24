export const ACTIONS = ["prefetch", "prerender"] as const;
export const TRIGGERS = [
	"visible",
	"immediate",
	"eager",
	"moderate",
	"conservative",
] as const;

export type SpeculationAction = (typeof ACTIONS)[number];
export type SpeculationTrigger = (typeof TRIGGERS)[number];

export type TargetLink = {
	id: number;
	href: string;
	/** The attributes that configure the link, empty for the control link that isn't speculated. */
	attributes: Record<string, string>;
	/** The attribute as written in markup, or null for the control link. */
	markup: string | null;
	action: SpeculationAction | null;
	trigger: SpeculationTrigger | null;
	note: string;
};

const TRIGGER_NOTES: Record<SpeculationTrigger, string> = {
	visible: "When the link scrolls into view",
	immediate: "As soon as the rule is added",
	eager: "On a short hover on desktop, sooner than moderate",
	moderate: "On hover (about 200ms) or pointerdown",
	conservative: "On pointerdown or touchstart",
};

const matrix: TargetLink[] = ACTIONS.flatMap((action, actionIndex) =>
	TRIGGERS.map((trigger, triggerIndex) => {
		const id = actionIndex * TRIGGERS.length + triggerIndex + 1;
		return {
			id,
			href: `/speculate/target/${id}`,
			attributes: { [`data-speculate--${action}`]: trigger },
			markup: `data-speculate--${action}="${trigger}"`,
			action,
			trigger,
			note: TRIGGER_NOTES[trigger],
		};
	}),
);

/** Every link the Speculate page renders, and every target page. */
export const targetLinks: TargetLink[] = [
	...matrix,
	{
		id: 11,
		href: "/speculate/target/11",
		attributes: { "data-speculate": "visible" },
		markup: 'data-speculate="visible"',
		action: "prefetch",
		trigger: "visible",
		note: "Inside a scroll container, below its fold",
	},
	{
		id: 12,
		href: "/speculate/target/12",
		attributes: {},
		markup: null,
		action: null,
		trigger: null,
		note: "No data-speculate attribute, so it is never speculated",
	},
	{
		id: 13,
		href: "/speculate/target/13",
		attributes: { "data-speculate--prefetch": "immediate" },
		markup: 'data-speculate--prefetch="immediate"',
		action: "prefetch",
		trigger: "immediate",
		note: "Added after init, and picked up by refresh()",
	},
];

export const findTarget = (id: number) =>
	targetLinks.find((link) => link.id === id);
