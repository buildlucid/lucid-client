import S from "../state.js";

/** The form an event belongs to: the form itself, a control's form, or the form around the target */
const formOf = (target: EventTarget | null) => {
	if (target instanceof HTMLFormElement) return target;
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLSelectElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLButtonElement
	)
		return target.form;
	return target instanceof Element ? target.closest("form") : null;
};

const route = (event: Event) => {
	const form = formOf(event.target);
	if (form) S.instances.get(form)?.handle(event);
};

/**
 * Register the required event listeners
 * - They live on the document, so fields added later, and controls outside the form with a `form` attribute, work without a refresh
 * - They run after the page's own listeners, so values have settled before they are checked
 * - Each submission is handled by a listener added to the end of the window's own as the event starts, so it runs after every other listener, even ones added after `init`, and a `submit` listener that calls `preventDefault()` takes the form over
 */
const registerEvents = () => {
	const { signal } = S.abortController;
	window.addEventListener(
		"submit",
		() => window.addEventListener("submit", route, { once: true, signal }),
		{ capture: true, signal },
	);
	for (const type of ["input", "change", "reset", "click"])
		document.addEventListener(type, route, { signal });
};

export default registerEvents;
