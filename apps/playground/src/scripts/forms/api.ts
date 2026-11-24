import type { FormState } from "@lucidclient/forms";
import { forms, startForms } from "../../lib/forms";
import { createLogger } from "../../lib/log";

const log = createLogger("api");

startForms();

const on = (call: string, handler: () => void) =>
	document
		.querySelector(`[data-call="${call}"]`)
		?.addEventListener("click", handler);

// --------------------------------------------------------
// Following the state

const readout = document.querySelector("[data-state-readout]");
const show = (state: FormState) => {
	if (readout) readout.textContent = JSON.stringify(state, null, 2);
};

/** Subscribes again after the page is initialised again, as destroy drops subscribers */
const follow = () => {
	const form = forms.get("subscribe");
	if (!form) return;
	show(form.state);
	form.subscribe(show);
};
follow();

// --------------------------------------------------------
// Checks of your own

const TAKEN = ["ada", "admin"];

document.addEventListener("form-submit", (event) => {
	const form = forms.get("username");
	if (event.target !== form?.element) return;
	const username = String(event.detail.data.get("username") ?? "").trim();
	if (!TAKEN.includes(username.toLowerCase())) return;
	event.preventDefault();
	form.setErrors({ username: "That username is taken" });
	log.warn(`"${username}" is taken, so the send was cancelled`);
});

// --------------------------------------------------------
// Fields added later

const added = document.querySelector("[data-added]");

on("add-phone", () => {
	if (!added || added.querySelector('[name="phone"]')) return;
	added.insertAdjacentHTML(
		"beforeend",
		`<div data-form--field="phone" class="form-field">
			<label class="label" for="dynamic-phone">Phone</label>
			<input class="input" id="dynamic-phone" name="phone" type="tel" required>
			<p class="error-text" data-form--error="phone"></p>
		</div>`,
	);
	log.info("Added a required phone field, without a refresh");
});

on("add-count", () => {
	if (!added || added.querySelector('[name="bio"]')) return;
	added.insertAdjacentHTML(
		"beforeend",
		`<div data-form--field="bio" class="form-field">
			<label class="label" for="dynamic-bio">Bio</label>
			<textarea class="input" id="dynamic-bio" name="bio" rows="2" data-form--maxlength="60"></textarea>
			<p class="hint" data-form--count="bio">You can enter up to 60 characters</p>
		</div>`,
	);
	log.info("Added a field with a character count, which needs refresh()");
});

on("refresh-dynamic", () => {
	forms.get("dynamic")?.refresh();
	log.info("Called refresh() on the dynamic form");
});

// --------------------------------------------------------
// get, validate and submit

on("get", () => {
	const element = document.querySelector("#methods-email");
	const byName = forms.get("methods");
	const byId = forms.get("api-methods");
	const byElement = element ? forms.get(element) : undefined;
	log.info("get by name, id and element", {
		sameForm: byName !== undefined && byName === byId && byId === byElement,
		state: byName?.state,
	});
});

on("validate", () => {
	log.info(
		`validate("email") returned ${forms.get("methods")?.validate("email")}`,
	);
});

on("submit", async () => {
	const result = await forms.get("methods")?.submit();
	log.info("submit() resolved", result ?? null);
});

on("clear", () => {
	forms.get("methods")?.clearErrors();
	log.info("Called clearErrors()");
});

// --------------------------------------------------------
// Destroy and init again

on("destroy", () => {
	forms.destroy();
	log.info("Called forms.destroy()");
});

on("init", () => {
	forms.init();
	follow();
	log.info("Called forms.init()");
});
