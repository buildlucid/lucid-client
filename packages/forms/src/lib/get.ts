import S from "../state.js";
import type { Form } from "../types.js";

/**
 * Returns the form for an element inside it, or for its id or `data-form` name
 */
const get = (target: Element | string): Form | undefined => {
	let element: Element | null;
	if (typeof target === "string") {
		element = document.getElementById(target);
		if (!(element instanceof HTMLFormElement))
			element =
				Array.from(S.instances.keys()).find(
					(form) => form.getAttribute("data-form") === target,
				) ?? null;
	} else element = target;

	const form =
		element instanceof HTMLFormElement
			? element
			: (element?.closest("form") ??
				(element && "form" in element
					? (element.form as HTMLFormElement | null)
					: null));
	return form ? S.instances.get(form)?.api : undefined;
};

export default get;
