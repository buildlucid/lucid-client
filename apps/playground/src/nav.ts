import catalyst from "../../../packages/catalyst/package.json";
import cookieController from "../../../packages/cookie-controller/package.json";
import speculate from "../../../packages/speculate/package.json";

export type NavPage = {
	title: string;
	href: string;
	description: string;
	isNew?: boolean;
};

export type NavGroup = {
	title: string;
	package: string;
	version: string;
	description: string;
	pages: NavPage[];
};

/** The sidebar and the overview page are both built from this list. */
const nav: NavGroup[] = [
	{
		title: "Cookie Controller",
		package: cookieController.name,
		version: cookieController.version,
		description:
			"Bring-your-own-markup cookie consent, with category consent and gated scripts and media.",
		pages: [
			{
				title: "Cookie Controller",
				href: "/cookie-controller",
				description:
					"The banner, the details dialog, every method, category buttons, gated media and policy versions.",
			},
		],
	},
	{
		title: "Speculate",
		package: speculate.name,
		version: speculate.version,
		description:
			"Speculation Rules for links with fallbacks, and intent-based data prefetching.",
		pages: [
			{
				title: "Speculate",
				href: "/speculate",
				description:
					"Every link action and trigger, how the target page loaded, and the Speculator cache.",
			},
		],
	},
	{
		title: "Catalyst",
		package: catalyst.name,
		version: catalyst.version,
		description:
			"An attribute-driven reactive UI runtime built on Solid. One page per feature.",
		pages: [
			{
				title: "Stores",
				href: "/catalyst/stores",
				description:
					"State, computed values and actions, scopes, markup-only stores, flush and error isolation.",
			},
			{
				title: "State attributes",
				href: "/catalyst/state-attributes",
				description:
					"How data-state--* values are parsed and typed, and how they stay in sync both ways.",
			},
			{
				title: "Persisted state",
				href: "/catalyst/persistence",
				description:
					"persisted() and data-persist, restore order, stale values, other tabs and clearPersisted.",
				isNew: true,
			},
			{
				title: "Bindings",
				href: "/catalyst/bindings",
				description:
					"data-bind attribute writes: booleans, aria and data attributes, nullish values and SVG.",
			},
			{
				title: "CSS variables",
				href: "/catalyst/css-variables",
				description:
					"data-css custom properties from state, computed values and loops, booleans, fallbacks and restored inline values.",
				isNew: true,
			},
			{
				title: "DOM",
				href: "/catalyst/dom",
				description:
					"data-dom text, html, value, focus, blur and scrollto, and action-returned values.",
			},
			{
				title: "Events",
				href: "/catalyst/events",
				description:
					"Element, document and window listeners, shared targets, custom events and async actions.",
			},
			{
				title: "Loops",
				href: "/catalyst/loops",
				description:
					"data-loop rendering, identity reuse, nested loops, $parent and placeholder markup.",
			},
			{
				title: "Forms",
				href: "/catalyst/forms",
				description:
					"Fields, validation, submission, field arrays, multi-step forms and known gaps.",
				isNew: true,
			},
			{
				title: "Focus traps",
				href: "/catalyst/traps",
				description:
					"Modals, stacked traps, the both specifier, data-trap-allow, focus restore and scroll lock.",
			},
			{
				title: "Effects & lifecycle",
				href: "/catalyst/lifecycle",
				description:
					"Store effects, cleanups, init and its cleanup, async init and refs.",
			},
			{
				title: "Scopes & nesting",
				href: "/catalyst/scopes",
				description:
					"Nested stores, cross-scope references, duplicate scopes and late stores.",
			},
			{
				title: "Dynamic markup",
				href: "/catalyst/dynamic-markup",
				description:
					"sync, disposal on removal, refresh, destroy and start, and Catalyst.add.",
			},
			{
				title: "Custom reactions",
				href: "/catalyst/custom-reactions",
				description:
					"Writing reactions with literal values, context.resolve and reactive effects.",
			},
			{
				title: "Benchmarks",
				href: "/catalyst/benchmarks",
				description:
					"Speed, memory and size compared with Alpine.js, petite-vue and hand-written DOM code.",
				isNew: true,
			},
		],
	},
];

export default nav;

/** The group a path belongs to, for the page header. */
export const findGroup = (pathname: string) =>
	nav.find((group) =>
		group.pages.some((page) => normalise(page.href) === normalise(pathname)),
	);

export const normalise = (pathname: string) =>
	pathname.replace(/\/+$/, "") || "/";
