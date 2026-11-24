import { recaptcha } from "@lucidclient/forms/recaptcha";
import { turnstile } from "@lucidclient/forms/turnstile";
import { startForms } from "../../lib/forms";
import { createLogger } from "../../lib/log";

const log = createLogger("widget");

startForms({ extensions: [turnstile, recaptcha] });

// A widget of our own, following the captcha protocol: it hands the form a
// promise that writes a token, and clears the token once the send is done.
const widget = document.querySelector<HTMLElement>("#protocol-widget");
const input = widget?.querySelector<HTMLInputElement>('[name="_captcha"]');
const text = widget?.querySelector("[data-widget-text]");
const fail = document.querySelector<HTMLInputElement>("[data-fail]");

widget?.addEventListener("captcha:token", (event) => {
	log.info("captcha:token: checking");
	if (text) text.textContent = "Checking…";
	const done = new Promise<void>((resolve) =>
		setTimeout(() => {
			const passed = !fail?.checked;
			if (input) input.value = passed ? `demo-${Date.now()}` : "";
			if (text) text.textContent = passed ? "Passed" : "Failed";
			log.info(`captcha:token: ${passed ? "passed" : "failed"}`);
			resolve();
		}, 1000),
	);
	(event as CustomEvent<(wait: Promise<unknown>) => void>).detail(done);
});

widget?.addEventListener("captcha:reset", () => {
	if (input) input.value = "";
	if (text) text.textContent = "Ready";
	log.info("captcha:reset: token cleared");
});
