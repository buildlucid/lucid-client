import { forms, startForms } from "../../lib/forms";
import { createLogger } from "../../lib/log";

const log = createLogger("basics");

startForms();

document
	.querySelector('[data-call="destroy"]')
	?.addEventListener("click", () => {
		const form = forms.get("nojs");
		if (!form) {
			log.warn("The subscribe form is already destroyed");
			return;
		}
		form.destroy();
		log.info("Destroyed the subscribe form");
	});

document
	.querySelector('[data-call="enhance"]')
	?.addEventListener("click", () => {
		forms.refresh();
		log.info("Called refresh()", forms.get("nojs")?.state);
	});
