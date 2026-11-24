import C from "../constants.js";
import S from "../state.js";
import type { SpeculationAction, Speculation } from "../types.js";

type Eagerness = "immediate" | "eager" | "moderate" | "conservative";

type ListRule = {
	source: "list";
	eagerness: Eagerness;
	urls: string[];
};

type RuleSet = Partial<Record<SpeculationAction, ListRule[]>>;

/**
 * Adds a URL to the rule for its action and eagerness, unless an earlier rule set already has it
 * - The URL keeps its hash, as the browser matches a navigation, and a link the visitor shows intent on, against the full URL
 */
const addUrl = (
	ruleSet: RuleSet,
	action: SpeculationAction,
	eagerness: Eagerness,
	url: URL,
) => {
	const key = `${action} ${eagerness} ${url.href}`;
	if (S.requested.has(key)) return;
	S.requested.add(key);

	const rules = (ruleSet[action] ??= []);
	let rule = rules.find((existing) => existing.eagerness === eagerness);
	if (!rule) {
		rule = { source: "list", eagerness, urls: [] };
		rules.push(rule);
	}
	rule.urls.push(url.href);
};

/**
 * Adds one Speculation Rules script to `<head>` for the given links
 * - `visible` links have been seen, so they are speculated straight away
 * - Prerendered URLs are also given a prefetch, as another candidate the browser can use
 * - Nothing is added when every rule already exists
 */
const rules = (speculations: Speculation[]) => {
	const ruleSet: RuleSet = {};

	for (const { action, trigger, url } of speculations) {
		const eagerness = trigger === "visible" ? "immediate" : trigger;
		addUrl(ruleSet, action, eagerness, url);
		if (action === "prerender") addUrl(ruleSet, "prefetch", eagerness, url);
	}
	if (Object.keys(ruleSet).length === 0) return;

	const script = document.createElement("script");
	script.type = "speculationrules";
	script.setAttribute(C.attributes.generated, "");
	script.textContent = JSON.stringify(ruleSet);
	document.head.append(script);
};

export default rules;
