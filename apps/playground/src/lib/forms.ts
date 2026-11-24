import forms, { type Options } from "@lucidclient/forms";
import { createLogger } from "./log";

const log = createLogger("forms");

const name = (target: EventTarget | null) =>
	target instanceof Element
		? target.getAttribute("data-form") || target.id || "form"
		: "form";

/** The data about to be sent, with files as their names and sizes and repeated names as lists */
const describe = (data: FormData) => {
	const values: Record<string, string | string[]> = {};
	for (const [key, value] of data) {
		const text =
			typeof value === "string" ? value : `${value.name} (${value.size} bytes)`;
		const existing = values[key];
		values[key] =
			existing === undefined
				? text
				: Array.isArray(existing)
					? [...existing, text]
					: [existing, text];
	}
	return values;
};

/**
 * Starts the forms library and logs every submit, success, error and failed
 * check. Each forms page calls this once, with the options its scenarios need.
 */
export const startForms = (options?: Options) => {
	document.addEventListener("form-submit", (event) => {
		log.info(`${name(event.target)}: sending`, describe(event.detail.data));
	});
	document.addEventListener("form-success", (event) => {
		log.success(`${name(event.target)}: sent`, event.detail.result);
	});
	document.addEventListener("form-error", (event) => {
		const { result, error } = event.detail;
		log.error(`${name(event.target)}: not sent`, error ?? result);
	});
	document.addEventListener("form-invalid", (event) => {
		log.warn(
			`${name(event.target)}: ${Object.keys(event.detail.errors).join(", ")} need fixing`,
			event.detail.errors,
		);
	});
	forms.init(options);
};

export { forms };
