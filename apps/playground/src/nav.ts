import carousel from "../../../packages/carousel/package.json";
import catalyst from "../../../packages/catalyst/package.json";
import cookieController from "../../../packages/cookie-controller/package.json";
import forms from "../../../packages/forms/package.json";
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
		title: "Carousel",
		package: carousel.name,
		version: carousel.version,
		description:
			"A scroll snap carousel that JavaScript enhances, with markers, looping, mouse drag and autoplay.",
		pages: [
			{
				title: "Basics",
				href: "/carousel/basics",
				description:
					"One slide at a time, generated markers, announcements, the page without JavaScript, right to left and vertical.",
				isNew: true,
			},
			{
				title: "Layouts",
				href: "/carousel/layouts",
				description:
					"Several slides in view, pages that move a whole view, centred slides of different widths and thumbnail links.",
				isNew: true,
			},
			{
				title: "Looping & drag",
				href: "/carousel/looping",
				description:
					"Infinite looping without cloned slides, rewinding at the ends, and dragging with a mouse.",
				isNew: true,
			},
			{
				title: "Autoplay",
				href: "/carousel/autoplay",
				description:
					"Autoplay with a rotation control, pausing on hover and focus, and inert slides out of view.",
				isNew: true,
			},
			{
				title: "Events & API",
				href: "/carousel/api",
				description:
					"carousel-change, subscribe, goTo, refresh for new markup, and destroying a carousel.",
				isNew: true,
			},
			{
				title: "Benchmarks",
				href: "/carousel/benchmarks",
				description:
					"Work, memory and size compared with Embla, Swiper, Splide, Swiper's CSS mode, Blossom and Swiffy Slider.",
				isNew: true,
			},
		],
	},
	{
		title: "Forms",
		package: forms.name,
		version: forms.version,
		description:
			"Forms that work without JavaScript, enhanced with accessible validation, error summaries, sending in place, files and captchas.",
		pages: [
			{
				title: "Basics",
				href: "/forms/basics",
				description:
					"Inline errors, a status, a sent message, an error summary, the form without JavaScript and errors the server rendered.",
				isNew: true,
			},
			{
				title: "Validation",
				href: "/forms/validation",
				description:
					"Native constraints with your own messages, when fields are checked, groups, matching fields, custom rules and character counts.",
				isNew: true,
			},
			{
				title: "Sending",
				href: "/forms/sending",
				description:
					"Every kind of response, native GET forms, formnovalidate, adding data before sending and redirects.",
				isNew: true,
			},
			{
				title: "Files",
				href: "/forms/files",
				description:
					"Drop zones, file lists with remove buttons, type and size checks, and file errors from the server.",
				isNew: true,
			},
			{
				title: "Captcha",
				href: "/forms/captcha",
				description:
					"Turnstile and reCAPTCHA with their test keys, and the captcha widget protocol with a widget of your own.",
				isNew: true,
			},
			{
				title: "Events & API",
				href: "/forms/api",
				description:
					"subscribe, setErrors from your own checks, fields added later, refresh, destroy and get.",
				isNew: true,
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
			},
			{
				title: "Bindings",
				href: "/catalyst/bindings",
				description:
					"data-bind attribute writes: booleans, aria and data attributes, nullish values and SVG.",
			},
			{
				title: "Classes",
				href: "/catalyst/classes",
				description:
					"data-class toggles one class or applies a list from strings, arrays and objects, keeping the element's own classes.",
			},
			{
				title: "CSS variables",
				href: "/catalyst/css-variables",
				description:
					"data-css custom properties from state, computed values and loops, booleans, fallbacks and restored inline values.",
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
					"Element, document, window and outside listeners, modifiers, key names, debounce, throttle and async actions.",
			},
			{
				title: "Loops",
				href: "/catalyst/loops",
				description:
					"data-loop rendering, identity reuse, nested loops, $parent and placeholder markup.",
			},
			{
				title: "Conditional rendering",
				href: "/catalyst/conditional",
				description:
					"data-if renders a template while a value is truthy and disposes it while it is falsy.",
			},
			{
				title: "Forms",
				href: "/catalyst/forms",
				description:
					"Fields, validation, submission, field arrays, multi-step forms, model modifiers and unique ids.",
			},
			{
				title: "Dialogs & popovers",
				href: "/catalyst/dialogs",
				description:
					"data-model on dialog, popover and details elements, kept in sync when the browser closes them.",
			},
			{
				title: "Focus traps",
				href: "/catalyst/traps",
				description:
					"Modals, stacked traps, the both specifier, data-trap-allow, focus restore and scroll lock.",
			},
			{
				title: "Visibility",
				href: "/catalyst/visibility",
				description:
					"data-intersect for lazy loading, reveals, infinite scroll and leaving the viewport.",
			},
			{
				title: "Animations",
				href: "/catalyst/animations",
				description:
					"viewTransition, the transition modifier, animated loops with match-element, types and CSS show and hide.",
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
					"sync, disposal on removal, refresh, destroy and start, Catalyst.add and data-ignore.",
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
