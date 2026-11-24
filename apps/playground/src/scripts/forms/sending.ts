import { forms, startForms } from "../../lib/forms";
import { createLogger } from "../../lib/log";

const log = createLogger("sending");

startForms();

// The response select points the form at a different mock endpoint.
const select = document.querySelector<HTMLSelectElement>("[data-response]");
select?.addEventListener("change", () => {
	const form = forms.get("responses")?.element;
	form?.setAttribute("action", `/mock/forms/${select.value}`);
	log.info(`The form now posts to /mock/forms/${select.value}`);
});

// Adds where the form was sent from to what's sent.
forms.get("extra")?.element.addEventListener("form-submit", (event) => {
	event.detail.data.append("source", "playground");
	event.detail.data.append("page", location.pathname);
});

const params = new URLSearchParams(location.search);
const search = document.querySelector("[data-search-result]");
if (search && params.has("q"))
	search.textContent = `Searched for "${params.get("q")}"`;
const redirect = document.querySelector("[data-redirect-result]");
if (redirect && params.has("redirected")) {
	redirect.textContent = `Redirected here by form ${params.get("redirected")}`;
	log.success(`Redirected here by form ${params.get("redirected")}`);
}
