import type { SpeculationTriggers, SpeculationActions } from "../types.js";
import validConnection from "../utils/valid-connection.js";

const C: {
	moderateEvents: Array<keyof HTMLElementEventMap>;
	fallbackTriggerSupport: Array<SpeculationTriggers>;
	fallbackTrigger: SpeculationTriggers;
	fallbackAction: SpeculationActions;
	validActions: SpeculationActions[];
	validTriggers: SpeculationTriggers[];
	attribute: string;
	selector: string;
	genSpeculate: string;
} = {
	moderateEvents: ["mouseenter", "touchstart", "focus"],
	fallbackTriggerSupport: ["visible", "moderate"],
	fallbackTrigger: "moderate",
	fallbackAction: "prefetch",
	validActions: ["prefetch", "prerender"],
	validTriggers: ["visible", "immediate", "eager", "moderate", "conservative"],
	/**
	 * Links follow the suite's `data-{namespace}--{specifier}` grammar: the action is the specifier and the trigger is the value
	 */
	attribute: "data-speculate",
	selector:
		"a[data-speculate], a[data-speculate--prefetch], a[data-speculate--prerender]",
	genSpeculate: "gen-speculate",
};

let initialised = false;
const prefetched = new Set<string>();
const speculationSupport =
	"supports" in HTMLScriptElement &&
	HTMLScriptElement.supports &&
	HTMLScriptElement.supports("speculationrules");
const prefetchSupport = document
	.createElement("link")
	.relList?.supports?.("prefetch");
let observer: IntersectionObserver;
let abortController = new AbortController();

/**
 * Unobserves and deregisters the target anchor element
 */
const unobserve = (target: HTMLAnchorElement) => {
	observer.unobserve(target);
	removeEventListeners(target);
};

/**
 * Handles registering event listeners for the given moderate trigger elements
 */
const addEventListeners = (element: HTMLAnchorElement) => {
	for (const event of C.moderateEvents) {
		element.addEventListener(event, intentEvent, {
			passive: true,
			signal: abortController.signal,
		});
	}
};

/**
 * Handles unregistering event listeners for the given moderate trigger elements
 */
const removeEventListeners = (element: HTMLAnchorElement) => {
	for (const event of C.moderateEvents) {
		element.removeEventListener(event, intentEvent);
	}
};

/**
 * Handles the event for the given intent trigger elements
 */
const intentEvent = (e: Event) => {
	const target = e.target as HTMLAnchorElement | null;
	if (!target) return;
	triggerAction(target, parseLinkConfig(target));
};

const triggerAction = (
	target: HTMLAnchorElement,
	config: [SpeculationActions, SpeculationTriggers],
) => {
	if (!shouldPreload({ href: target.href, target: target.target })) {
		return unobserve(target);
	}

	if (speculationSupport) addSpeculationRules(target.href, config);
	else if (prefetchSupport) addLinkPrefetch(target.href);
	else fetch(target.href, { priority: "low", signal: abortController.signal });

	prefetched.add(target.href);
	unobserve(target);
};

/**
 * Adds a speculation rule to the document head
 */
const addSpeculationRules = (
	href: string,
	config: [SpeculationActions, SpeculationTriggers],
) => {
	try {
		const specScript = document.createElement("script");
		specScript.type = "speculationrules";
		specScript.setAttribute(C.genSpeculate, "");
		const item = [
			{
				source: "list",
				urls: [href],
				eagerness: config[1] === "visible" ? undefined : config[1],
			},
		];
		specScript.textContent =
			config[0] === "prefetch"
				? JSON.stringify({
						prefetch: item,
					})
				: JSON.stringify({
						// prefetch is used as a fallback when prerender fails
						prerender: item,
						prefetch: item,
					});
		document.head.appendChild(specScript);
	} catch (e) {
		console.error(e);
	}
};

/**
 * Adds a link prefetch to the document head
 */
const addLinkPrefetch = (href: string) => {
	const link = document.createElement("link");
	link.rel = "prefetch";
	link.setAttribute(C.genSpeculate, "");
	link.href = href;
	link.as = "document";
	document.head.appendChild(link);
};

/**
 * Reads the link's action and trigger, and determines the correct ones based on support
 * - `data-speculate--prerender` and `data-speculate--prefetch` name the action, and their value is the trigger
 * - `data-speculate` prefetches, and its value is the trigger
 * - An empty or unknown trigger falls back to `moderate`
 * @returns A tuple of the action and trigger
 */
const parseLinkConfig = (
	link: HTMLAnchorElement,
): [SpeculationActions, SpeculationTriggers] => {
	let action: string = C.fallbackAction;
	let trigger = link.getAttribute(C.attribute);

	// prerender is checked first, so it wins when a link has both
	for (const candidate of ["prerender", "prefetch"] as const) {
		const value = link.getAttribute(`${C.attribute}--${candidate}`);
		if (value !== null) {
			action = candidate;
			trigger = value;
			break;
		}
	}

	trigger = trigger?.trim() || C.fallbackTrigger;

	if (!speculationSupport) {
		// prerender defaults to prefetch when speculation rules are not supported
		action = C.fallbackAction;
		// fallback to intent, if trigger is not supported
		if (!C.fallbackTriggerSupport.includes(trigger as SpeculationTriggers))
			trigger = C.fallbackTrigger;
	}

	if (!C.validActions.includes(action as SpeculationActions))
		action = C.fallbackAction;
	if (!C.validTriggers.includes(trigger as SpeculationTriggers))
		trigger = C.fallbackTrigger;

	return [action, trigger] as [SpeculationActions, SpeculationTriggers];
};

/**
 * Determines if the given link should be preloaded
 */
const shouldPreload = (props: { href: string; target: string }): boolean => {
	try {
		props.href = props.href.replace(/#.*/, "");
		if (props.target === "_blank") return false;
		if (props.href.includes("mailto:")) return false;
		if (props.href.includes("tel:")) return false;

		const url = new URL(props.href);
		if (url.origin !== window.location.origin) return false;
		if (url.pathname === window.location.pathname) return false;
		if (prefetched.has(props.href)) return false;

		return true;
	} catch (_) {
		return false;
	}
};

/**
 * Initialises the speculation library
 */
const speculationLinks = () => {
	if (initialised) return;
	initialised = true;

	const valid = validConnection();
	if (!valid) return;

	// setup observer
	observer =
		observer ||
		new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.target instanceof HTMLAnchorElement) {
					const target = entry.target;
					const [action, trigger] = parseLinkConfig(target);

					if (trigger === "visible") triggerAction(target, [action, trigger]);
					else unobserve(target);
				}
			}
		});

	// setup link config, observers and events
	const targetLinks: NodeListOf<HTMLAnchorElement> = document.querySelectorAll(
		C.selector,
	);

	for (const l of targetLinks) {
		const [action, trigger] = parseLinkConfig(l);

		if (trigger === "visible") {
			observer.observe(l);
		}
		// piggyback off moderate trigger for prefetch when speculation rules are not supported
		else if (trigger === "moderate" && !speculationSupport) {
			addEventListeners(l);
		} else {
			triggerAction(l, [action, trigger]);
		}
	}
};

/**
 * Destroys and resets the speculate instance. This will also tidy up any generated speculation rules, prefetch links and cancel any on-going fetches.
 */
const destroy = () => {
	abortController.abort();
	abortController = new AbortController();
	observer?.disconnect();
	prefetched.clear();
	initialised = false;

	const clearEles = document.querySelectorAll(
		`link[${C.genSpeculate}], script[${C.genSpeculate}]`,
	);
	for (const ele of clearEles) {
		ele.remove();
	}
};

/**
 * Initialises the speculation library using requestIdleCallback if available
 */
const init = () => {
	typeof requestIdleCallback !== "undefined"
		? requestIdleCallback(speculationLinks)
		: setTimeout(speculationLinks, 0);

	return destroy;
};

export default init;
