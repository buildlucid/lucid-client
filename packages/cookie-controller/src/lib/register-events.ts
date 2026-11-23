import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

const { value } = C.attributes.action;

/**
 * Runs the action for a clicked `data-cookie--action` element.
 * - `accept` and `reject` only update one category when the element also has a `data-cookie--category` attribute
 * - `dismiss` closes the alert when it is inside the alert, otherwise it closes the details element
 */
const onActionClick = (event: Event) => {
	if (!(event.target instanceof Element)) return;
	const target = event.target.closest(`[${C.attributes.action.attribute}]`);
	if (!target) return;

	const action = target.getAttribute(C.attributes.action.attribute);
	const category = target.getAttribute(C.attributes.cookieCategory);

	switch (action) {
		case value.accept:
			if (category) lib.updateConsent({ [category]: true });
			else lib.acceptAll();
			break;
		case value.reject:
			if (category) lib.updateConsent({ [category]: false });
			else lib.rejectAll();
			break;
		case value.save:
			lib.saveDetails();
			break;
		case value.details:
			lib.toggleDetails();
			break;
		case value.dismiss:
			// Inside the alert it closes the alert, anywhere else it closes the details element.
			if (target.closest(`[${C.attributes.alert}]`)) lib.closeAlert();
			else lib.closeDetails();
			break;
	}
};

/**
 * Treats Escape on the details dialog as closing it without saving.
 */
const onDetailsCancel = (event: Event) => {
	if (event.target !== S.elements?.details) return;
	event.preventDefault();
	lib.closeDetails();
};

/**
 * Register the required event listeners
 * - Listeners live on the document, so action elements added after initialisation work without a refresh
 * - `cancel` does not bubble, so it is listened for in the capture phase
 */
const registerEvents = () => {
	const { signal } = S.abortController;

	document.addEventListener("click", onActionClick, { signal });
	document.addEventListener("cancel", onDetailsCancel, {
		capture: true,
		signal,
	});
};

export default registerEvents;
