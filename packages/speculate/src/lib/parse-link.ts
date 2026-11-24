import C from "../constants.js";
import S from "../state.js";
import type {
	LinkConfig,
	SpeculationAction,
	SpeculationTrigger,
} from "../types.js";
import lib from "./index.js";

const isTrigger = (value: string): value is SpeculationTrigger =>
	(C.triggers as ReadonlyArray<string>).includes(value);

/**
 * Reads a trigger, falling back to the default when it is empty or unknown
 */
const readTrigger = (
	value: string,
	link: HTMLAnchorElement,
): SpeculationTrigger => {
	if (value === "") return C.defaultTrigger;
	if (isTrigger(value)) return value;

	if (__DEV__) {
		lib.log(
			"warn",
			`The link to ${link.getAttribute("href")} has an unknown trigger, "${value}", so it uses "${C.defaultTrigger}". Use one of ${C.triggers.join(", ")}.`,
		);
	}
	return C.defaultTrigger;
};

/**
 * Reads a link's action and trigger
 * - `data-speculate--prerender` and `data-speculate--prefetch` name the action, and their value is the trigger. Prerender wins when a link has both
 * - `data-speculate` on its own prefetches, and its value is the trigger
 * - Without Speculation Rules, prerender becomes prefetch, and triggers other than `visible` become `moderate`
 */
const parseLink = (link: HTMLAnchorElement): LinkConfig => {
	const action: SpeculationAction = link.hasAttribute(C.attributes.prerender)
		? "prerender"
		: "prefetch";
	const value =
		link.getAttribute(C.attributes[action]) ??
		link.getAttribute(C.attributes.speculate) ??
		"";
	const trigger = readTrigger(value.trim().toLowerCase(), link);

	if (S.support.rules) return { action, trigger };
	return {
		action: "prefetch",
		trigger: C.fallbackTriggers.includes(trigger) ? trigger : C.defaultTrigger,
	};
};

export default parseLink;
