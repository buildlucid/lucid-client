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
	/** The `rel` value, or null for the control link that isn't speculated. */
	rel: string | null;
	action: SpeculationAction | null;
	trigger: SpeculationTrigger | null;
	note: string;
};

const TRIGGER_NOTES: Record<SpeculationTrigger, string> = {
	visible: "When the link scrolls into view",
	immediate: "As soon as the rule is added",
	eager: "As soon as possible, slightly behind immediate",
	moderate: "On hover (about 200ms) or pointerdown",
	conservative: "On pointerdown or touchstart",
};

const matrix: TargetLink[] = ACTIONS.flatMap((action, actionIndex) =>
	TRIGGERS.map((trigger, triggerIndex) => {
		const id = actionIndex * TRIGGERS.length + triggerIndex + 1;
		return {
			id,
			href: `/speculate/target/${id}`,
			rel: `${action}:${trigger}`,
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
		rel: "prefetch:visible",
		action: "prefetch",
		trigger: "visible",
		note: "Inside a scroll container, below its fold",
	},
	{
		id: 12,
		href: "/speculate/target/12",
		rel: null,
		action: null,
		trigger: null,
		note: "No rel, so it is never speculated",
	},
];

export const findTarget = (id: number) =>
	targetLinks.find((link) => link.id === id);
