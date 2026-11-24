import { startForms } from "../../lib/forms";

/** A loose UK postcode check, such as SW1A 1AA or M1 1AE */
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const FREE_EMAIL = /@(gmail|hotmail|outlook|yahoo)\./i;

startForms({
	rules: {
		postcode: (value) =>
			POSTCODE.test(value.trim()) ||
			"Enter a real UK postcode, such as SW1A 1AA",
		"work-email": (value) => !FREE_EMAIL.test(value),
	},
});
