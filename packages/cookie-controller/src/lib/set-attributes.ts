import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/** Whether an element has a name of its own from `aria-label` or `aria-labelledby` */
const named = (element: Element) =>
	element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby");

/** Whether an element has no meaning of its own: a `div`, `span` or custom element without a role */
const isGeneric = (element: Element) =>
	!element.hasAttribute("role") &&
	(element.localName === "div" ||
		element.localName === "span" ||
		element.localName.includes("-"));

/**
 * Adds the accessibility attributes the markup leaves out. Anything the
 * markup sets itself is kept, and `restoreAttributes` removes what was added.
 * - The alert is a named region, as GOV.UK's cookie banner is, so it isn't read out when it appears and can be found as a landmark
 * - The details element is named, and is a dialog when it isn't a `<dialog>` already
 * - Status elements are polite live regions that can take focus once a decision closes what held it
 */
const setAttributes = () => {
	const elements = S.elements;
	if (!elements) return;
	const { alert, details } = elements;

	if (details) {
		lib.addAttribute(details, "id", C.ids.details);
		// A `<dialog>` is a dialog already, and `showModal()` moves focus into it. Other elements take focus themselves.
		if (!(details instanceof HTMLDialogElement)) {
			lib.addAttribute(details, "role", "dialog");
			lib.addAttribute(details, "tabindex", "-1");
		}
		if (!named(details))
			lib.addAttribute(details, "aria-label", lib.message("details"));
	}
	if (alert) {
		lib.addAttribute(alert, "id", C.ids.alert);
		if (isGeneric(alert)) lib.addAttribute(alert, "role", "region");
		if (!named(alert))
			lib.addAttribute(alert, "aria-label", lib.message("alert"));
	}

	for (const status of elements.statuses) {
		if (!status.hasAttribute("aria-live"))
			lib.addAttribute(status, "role", "status");
		lib.addAttribute(status, "aria-atomic", "true");
		lib.addAttribute(status, "tabindex", "-1");
	}

	// Essential cookies are always on, so an essential checkbox is informational only.
	for (const element of elements.categoryCheckboxes) {
		if (element.getAttribute(C.attributes.cookieCategory) === "essential") {
			element.checked = true;
			element.disabled = true;
		}
	}

	if (details?.id)
		for (const element of elements.actionDetails)
			lib.addAttribute(element, "aria-controls", details.id);

	if (__DEV__) checkMarkup();
};

/** Logs a warning once per `init`, so refreshing doesn't log it again */
const warnOnce = (message: string) => {
	if (S.warnings.has(message)) return;
	S.warnings.add(message);
	lib.log("warn", message);
};

/** Warns about markup that leaves some visitors out */
const checkMarkup = () => {
	const details = S.elements?.details;
	if (details && !(details instanceof HTMLDialogElement))
		warnOnce(
			"The data-cookie--details element isn't a <dialog>, so it isn't modal. Use a <dialog>, which the library opens with showModal(), so focus stays inside it while it is open.",
		);
	for (const checkbox of S.elements?.categoryCheckboxes ?? []) {
		if (
			checkbox.labels?.length ||
			checkbox.hasAttribute("aria-label") ||
			checkbox.hasAttribute("aria-labelledby")
		)
			continue;
		warnOnce(
			`The "${checkbox.getAttribute(C.attributes.cookieCategory)}" category checkbox has no label. Give it a <label> that says what it allows.`,
		);
	}
};

export default setAttributes;
