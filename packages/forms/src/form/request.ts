import C from "../constants.js";
import { formAttr } from "./dom.js";

/** The method a submission uses: the submitter's `formmethod`, or the form's `method` */
export const methodOf = (
	form: HTMLFormElement,
	submitter: HTMLElement | null,
) => {
	const method = (
		submitter?.getAttribute("formmethod") ??
		formAttr(form, "method") ??
		""
	).toLowerCase();
	return method === "post" || method === "dialog" ? method : "get";
};

/**
 * Whether the form is sent with `fetch` or left to the browser
 * - `data-form--submit` chooses, and otherwise POST forms are fetched while GET and dialog forms submit natively
 */
export const submitMode = (
	form: HTMLFormElement,
	submitter: HTMLElement | null,
): "fetch" | "native" => {
	const method = methodOf(form, submitter);
	if (method === "dialog") return "native";
	const option = formAttr(form, C.attributes.submit);
	if (option === "fetch" || option === "native") return option;
	return method === "post" ? "fetch" : "native";
};

const actionOf = (form: HTMLFormElement, submitter: HTMLElement | null) => {
	const action =
		submitter?.getAttribute("formaction") ?? formAttr(form, "action");
	return action ? new URL(action, document.baseURI) : new URL(document.URL);
};

const enctypeOf = (form: HTMLFormElement, submitter: HTMLElement | null) =>
	(
		submitter?.getAttribute("formenctype") ??
		formAttr(form, "enctype") ??
		""
	).toLowerCase();

const isEmptyFile = (value: FormDataEntryValue) =>
	value instanceof File && value.name === "" && value.size === 0;

/** Removes the empty files that file inputs without a selection add, which many servers refuse */
const dropEmptyFiles = (data: FormData) => {
	for (const name of new Set(data.keys())) {
		const values = data.getAll(name);
		if (!values.some(isEmptyFile)) continue;
		data.delete(name);
		for (const value of values)
			if (!isEmptyFile(value)) data.append(name, value);
	}
};

/** The form's data, including the name and value of the button that submitted it */
export const readFormData = (
	form: HTMLFormElement,
	submitter: HTMLElement | null,
) => {
	let data: FormData;
	try {
		data = new FormData(form, submitter);
	} catch {
		// Older browsers don't take a submitter, and it must be one of the form's own submit buttons.
		data = new FormData(form);
		const name = submitter?.getAttribute("name");
		if (submitter && name)
			data.append(name, (submitter as HTMLButtonElement).value ?? "");
	}
	dropEmptyFiles(data);
	return data;
};

/** Line breaks are sent as CRLF, as browsers do when they submit a form themselves */
const crlf = (text: string) => text.replace(/\r\n|\r|\n/g, "\r\n");

const asText = (data: FormData) =>
	new URLSearchParams(
		Array.from(data, ([name, value]): [string, string] => [
			crlf(name),
			crlf(typeof value === "string" ? value : value.name),
		]),
	);

/**
 * Builds the request a native submission would make, asking for JSON. GET
 * forms send their data in the query string, and POST forms send multipart
 * data when they hold files or ask for it with `enctype`, and URL encoded data
 * otherwise.
 */
export const buildRequest = (
	form: HTMLFormElement,
	submitter: HTMLElement | null,
	data: FormData,
	signal: AbortSignal,
) => {
	const url = actionOf(form, submitter);
	const headers = { Accept: "application/json" };
	if (methodOf(form, submitter) !== "post") {
		url.search = asText(data).toString();
		return new Request(url, { method: "GET", headers, signal });
	}
	const multipart =
		enctypeOf(form, submitter) === "multipart/form-data" ||
		Array.from(data.values()).some((value) => value instanceof File);
	return new Request(url, {
		method: "POST",
		headers,
		body: multipart ? data : asText(data),
		signal,
	});
};

/** The attributes a submitter can override on its form, and the form attribute each replaces */
const OVERRIDES = [
	["formaction", "action"],
	["formmethod", "method"],
	["formenctype", "enctype"],
	["formtarget", "target"],
] as const;

/**
 * Submits the form natively for a submitter, without a second `submit`
 * event, as the page has already handled the visitor's. The submitter's
 * overrides and its name and value are applied for the moment the browser
 * reads the form, which it does before `submit()` returns.
 */
export const submitNatively = (
	form: HTMLFormElement,
	submitter: HTMLElement | null,
	coordinates: Array<[string, string]> = [],
) => {
	const undo: Array<() => void> = [];
	const set = (name: string, value: string | null) =>
		value === null
			? Element.prototype.removeAttribute.call(form, name)
			: Element.prototype.setAttribute.call(form, name, value);

	for (const [from, to] of submitter ? OVERRIDES : []) {
		const value = submitter?.getAttribute(from) ?? null;
		if (value === null) continue;
		const previous = formAttr(form, to);
		set(to, value);
		undo.push(() => set(to, previous));
	}
	const add = (name: string, value: string) => {
		const input = document.createElement("input");
		input.type = "hidden";
		input.name = name;
		input.value = value;
		Element.prototype.append.call(form, input);
		undo.push(() => input.remove());
	};
	const name = submitter?.getAttribute("name");
	// An image button sends where it was pressed rather than its value.
	if (coordinates.length > 0)
		for (const [key, value] of coordinates) add(key, value);
	else if (submitter && name)
		add(name, (submitter as HTMLButtonElement).value ?? "");

	try {
		HTMLFormElement.prototype.submit.call(form);
	} finally {
		for (const step of undo) step();
	}
};
