import C from "../constants.js";

/**
 * Get the required elements for the library
 */
const getElements = () => ({
	details: document.querySelector<HTMLElement>(`[${C.attributes.details}]`),
	banner: document.querySelector<HTMLElement>(`[${C.attributes.banner}]`),
	categoryCheckboxes: document.querySelectorAll<HTMLInputElement>(
		`input[type="checkbox"][${C.attributes.cookieCategory}]`,
	),
	actionDetails: document.querySelectorAll(
		`[${C.attributes.action.attribute}="${C.attributes.action.value.details}"]`,
	),
	statuses: document.querySelectorAll<HTMLElement>(`[${C.attributes.status}]`),
});

export default getElements;
