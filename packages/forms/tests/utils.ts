import { vi } from "vite-plus/test";

export const $ = <E extends Element = HTMLElement>(selector: string) => {
	const element = document.querySelector<E>(selector);
	if (!element) throw new Error(`No element matches ${selector}`);
	return element;
};

export const $$ = <E extends Element = HTMLElement>(selector: string) =>
	Array.from(document.querySelectorAll<E>(selector));

/** Waits for pending promises and timers of 0ms to run */
export const settle = async () => {
	for (let i = 0; i < 5; i++)
		await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Sets a field's value as a visitor would, firing `input` and `change` */
export const type = (selector: string, value: string) => {
	const control = $<HTMLInputElement | HTMLTextAreaElement>(selector);
	control.value = value;
	control.dispatchEvent(new Event("input", { bubbles: true }));
	control.dispatchEvent(new Event("change", { bubbles: true }));
};

/** Ticks or unticks a checkbox or radio, firing `input` and `change` */
export const check = (selector: string, checked = true) => {
	const control = $<HTMLInputElement>(selector);
	control.checked = checked;
	control.dispatchEvent(new Event("input", { bubbles: true }));
	control.dispatchEvent(new Event("change", { bubbles: true }));
};

/** Gives a file input files, firing `input` and `change` */
export const pick = (selector: string, files: File[]) => {
	const input = $<HTMLInputElement>(selector);
	const transfer = new DataTransfer();
	for (const file of files) transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

/** A file of a given size in bytes */
export const file = (name: string, size = 10, type = "") =>
	new File([new Uint8Array(size)], name, { type });

/** Submits a form with its first submit button, as a visitor would */
export const submit = (selector = "form") => {
	const form = $<HTMLFormElement>(selector);
	const button = form.querySelector<HTMLElement>(
		"button:not([type]), [type=submit]",
	);
	if (button) button.click();
	else form.requestSubmit();
};

/** Stubs `fetch` with a responder, and returns the mock to read the requests it got */
export const mockFetch = (
	respond: (request: Request) => Response | Promise<Response> = () =>
		Response.json({}),
) => {
	const fetch = vi.fn(async (input: RequestInfo | URL) =>
		respond(input instanceof Request ? input : new Request(input)),
	);
	vi.stubGlobal("fetch", fetch);
	return fetch;
};

/** The request a mocked `fetch` received */
export const requestOf = (fetch: ReturnType<typeof mockFetch>, index = 0) => {
	const request = fetch.mock.calls[index]?.[0];
	if (!(request instanceof Request)) throw new Error("No request was sent");
	return request;
};

/** A simple contact form, with an error, status, summary and sent element */
export const contactForm = ({
	attributes = "",
	extra = "",
	summary = false,
}: { attributes?: string; extra?: string; summary?: boolean } = {}) => `
	<form data-form="contact" id="contact" method="post" action="/submit" ${attributes}>
		<div data-form--status></div>
		${
			summary
				? `<div data-form--summary><h2>There is a problem</h2><ul><template><li><a href="#{id}">{message}</a></li></template></ul></div>`
				: ""
		}
		<div data-form--field="name">
			<label for="name">Name <span aria-hidden="true">*</span></label>
			<input id="name" name="name" required>
			<p data-form--error="name"></p>
		</div>
		<div data-form--field="email">
			<label for="email">Email</label>
			<input id="email" name="email" type="email" required>
			<p data-form--error="email"></p>
		</div>
		${extra}
		<button id="send">Send</button>
		<div data-form--sent>Thanks, we'll be in touch.</div>
	</form>
`;
