import C from "../constants.js";

/**
 * Get the required elements for the library
 */
const getElements = () => ({
	details: document.querySelector<HTMLElement>(`[${C.attributes.details}]`),
	alert: document.querySelector(`[${C.attributes.alert}]`),
	categoryCheckboxes: document.querySelectorAll<HTMLInputElement>(
		`input[type="checkbox"][${C.attributes.cookieCategory}]`,
	),
	actionDetails: document.querySelectorAll(
		`[${C.attributes.action.attribute}="${C.attributes.action.value.details}"]`,
	),
});

export default getElements;
