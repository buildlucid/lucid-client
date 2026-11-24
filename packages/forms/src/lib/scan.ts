import C from "../constants.js";
import createForm from "../form/create.js";
import S from "../state.js";
import type { Form } from "../types.js";
import log from "./log.js";

/** Removes a destroyed form from the registry */
export const forget = (form: Form) => {
	S.instances.delete(form.element);
};

/**
 * Enhances every `data-form` element that isn't enhanced yet
 */
const scan = () => {
	for (const element of document.querySelectorAll(`[${C.attributes.root}]`)) {
		if (!(element instanceof HTMLFormElement)) {
			if (__DEV__)
				log(
					"warn",
					"data-form only works on <form> elements, so one was skipped.",
				);
			continue;
		}
		if (S.instances.has(element)) continue;
		try {
			const instance = createForm(element, forget);
			S.instances.set(element, instance);
		} catch (error) {
			// One form failing leaves the others to be enhanced, and itself as it was rendered.
			log("error", "A form couldn't be enhanced.", error);
		}
	}
};

export default scan;
