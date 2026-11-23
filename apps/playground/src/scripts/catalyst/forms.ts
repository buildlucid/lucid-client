import { defineStore, flush, snapshot } from "@lucidclient/catalyst";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

// --------------------------------------------------------
// Field helpers shared by the stores on this page

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const fieldFrom = (event: Event): FieldElement | null => {
	const target = event.target;
	return target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
		? target
		: null;
};

/** A field's value, typed the way its state stores it. */
const readField = (field: FieldElement): string | number | boolean | null => {
	if (field instanceof HTMLInputElement) {
		if (field.type === "checkbox") return field.checked;
		if (field.type === "number" || field.type === "range") {
			return Number.isNaN(field.valueAsNumber) ? null : field.valueAsNumber;
		}
	}
	return field.value;
};

/**
 * Copies the event's field onto the state key matching the field's `name`.
 * One listener on a form handles every field this way, because `input`
 * events bubble.
 */
const assignField = (draft: object, event: Event) => {
	const field = fieldFrom(event);
	if (!field?.name || !(field.name in draft)) return;
	(draft as Record<string, unknown>)[field.name] = readField(field);
};

const json = (value: unknown) => JSON.stringify(value, null, 2);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const money = new Intl.NumberFormat("en-GB", {
	style: "currency",
	currency: "GBP",
});

// --------------------------------------------------------
// Text and number fields

const profile = defineStore({
	state: {
		name: "Ada Lovelace",
		email: "ada@example.com",
		age: 36 as number | null,
		bio: "",
	},
	computed: ({ state }) => ({
		json: () =>
			json({
				name: state.name,
				email: state.email,
				age: state.age,
				bio: state.bio,
			}),
		bioCount: () => `${state.bio.length} / 140`,
	}),
	actions: ({ setState }) => ({
		setField: (event: Event) => setState((draft) => assignField(draft, event)),
		fillSample: () =>
			setState((draft) => {
				draft.name = "Grace Hopper";
				draft.email = "grace@example.com";
				draft.age = 85;
				draft.bio = "Wrote the first compiler.";
			}),
		clear: () =>
			setState((draft) => {
				draft.name = "";
				draft.email = "";
				draft.age = null;
				draft.bio = "";
			}),
	}),
});

// --------------------------------------------------------
// Two-way binding

const MODELLED_DEFAULTS = {
	name: "Ada Lovelace",
	seats: 3 as number | null,
	newsletter: true,
	plan: "pro",
	topics: ["catalyst"] as string[],
	size: "m",
	tags: ["docs"] as string[],
	notes: "",
};

const modelled = defineStore({
	state: () => structuredClone(MODELLED_DEFAULTS),
	computed: ({ state }) => ({
		json: () =>
			json({
				name: state.name,
				seats: state.seats,
				newsletter: state.newsletter,
				plan: state.plan,
				topics: state.topics,
				size: state.size,
				tags: state.tags,
				notes: state.notes,
			}),
	}),
	actions: ({ setState }) => ({
		fillSample: () =>
			setState((draft) => {
				draft.name = "Grace Hopper";
				draft.seats = 12;
				draft.newsletter = false;
				draft.plan = "team";
				draft.topics = ["speculate", "cookies"];
				draft.size = "l";
				draft.tags = ["design", "support"];
				draft.notes = "Filled from state.";
			}),
		clear: () =>
			setState((draft) => {
				draft.name = "";
				draft.seats = null;
				draft.newsletter = false;
				draft.plan = "free";
				draft.topics = [];
				draft.size = "s";
				draft.tags = [];
				draft.notes = "";
			}),
	}),
});

// --------------------------------------------------------
// Checkboxes and radios

const choices = defineStore({
	state: {
		newsletter: false,
		plan: "pro",
	},
	computed: ({ state }) => ({
		planFree: () => state.plan === "free",
		planPro: () => state.plan === "pro",
		planTeam: () => state.plan === "team",
		json: () => json({ newsletter: state.newsletter, plan: state.plan }),
	}),
	actions: ({ setState }) => ({
		setField: (event: Event) => setState((draft) => assignField(draft, event)),
		toggleNewsletter: () =>
			setState((draft) => {
				draft.newsletter = !draft.newsletter;
			}),
		chooseTeam: () =>
			setState((draft) => {
				draft.plan = "team";
			}),
		chooseFree: () =>
			setState((draft) => {
				draft.plan = "free";
			}),
	}),
});

// --------------------------------------------------------
// Selects

const selects = defineStore({
	state: {
		size: "m",
		interests: [] as string[],
	},
	computed: ({ state }) => ({
		json: () => json({ size: state.size, interests: state.interests }),
	}),
	actions: ({ setState }) => ({
		setField: (event: Event) => setState((draft) => assignField(draft, event)),
		pickXl: () =>
			setState((draft) => {
				draft.size = "xl";
			}),
		setInterests: (event: Event) => {
			const field = fieldFrom(event);
			if (!(field instanceof HTMLSelectElement)) return;
			const values = Array.from(
				field.selectedOptions,
				(option) => option.value,
			);
			setState((draft) => {
				draft.interests = values;
			});
		},
		pickDesignAndDocs: () =>
			setState((draft) => {
				draft.interests = ["design", "docs"];
			}),
	}),
});

// --------------------------------------------------------
// Dependent selects

type Region = { value: string; label: string };
const REGIONS: Record<string, Region[]> = {
	uk: [
		{ value: "england", label: "England" },
		{ value: "scotland", label: "Scotland" },
		{ value: "wales", label: "Wales" },
		{ value: "ni", label: "Northern Ireland" },
	],
	us: [
		{ value: "ca", label: "California" },
		{ value: "ny", label: "New York" },
		{ value: "tx", label: "Texas" },
	],
	de: [
		{ value: "be", label: "Berlin" },
		{ value: "by", label: "Bavaria" },
		{ value: "hh", label: "Hamburg" },
	],
};
const regionsFor = (country: string) => REGIONS[country] ?? [];

const address = defineStore({
	state: { country: "uk", region: "scotland" },
	computed: ({ state }) => ({
		regions: () => regionsFor(state.country),
		json: () => json({ country: state.country, region: state.region }),
	}),
	actions: ({ setState }) => ({
		setField: (event: Event) => setState((draft) => assignField(draft, event)),
		setCountry: (event: Event) => {
			const field = fieldFrom(event);
			if (!field) return;
			setState((draft) => {
				draft.country = field.value;
				draft.region = regionsFor(field.value)[0]?.value ?? "";
			});
		},
		pickTexas: () =>
			setState((draft) => {
				draft.country = "us";
				draft.region = "tx";
			}),
		pickWales: () =>
			setState((draft) => {
				draft.country = "uk";
				draft.region = "wales";
			}),
	}),
});

// --------------------------------------------------------
// Validation

const signupLog = createLogger("signup");

type SignupFields = {
	email: string;
	password: string;
	confirm: string;
	terms: boolean;
};
type SignupField = keyof SignupFields;
const SIGNUP_FIELDS: SignupField[] = ["email", "password", "confirm", "terms"];

const validateSignup = (
	values: SignupFields,
): Record<SignupField, string | null> => ({
	email: !values.email
		? "Enter your email address."
		: /^\S+@\S+\.\S+$/.test(values.email)
			? null
			: "Enter an email address like name@example.com.",
	password: values.password.length >= 8 ? null : "Use at least 8 characters.",
	confirm: !values.confirm
		? "Enter your password again."
		: values.confirm === values.password
			? null
			: "The passwords don't match.",
	terms: values.terms ? null : "Accept the terms to continue.",
});

const passwordScore = (password: string) =>
	[
		password.length >= 8,
		password.length >= 12,
		/[A-Z]/.test(password) && /[a-z]/.test(password),
		/\d/.test(password) && /[^A-Za-z0-9]/.test(password),
	].filter(Boolean).length;

const signup = defineStore({
	state: {
		email: "",
		password: "",
		confirm: "",
		terms: false,
		touched: { email: false, password: false, confirm: false, terms: false },
		submitted: false,
	},
	computed: ({ state }) => {
		// An error shows once its field has been left, or after a submit.
		const invalidCount = () =>
			state.submitted
				? Object.values(validateSignup(state)).filter((error) => error !== null)
						.length
				: 0;
		const visibleError = (field: SignupField) =>
			state.touched[field] || state.submitted
				? validateSignup(state)[field]
				: null;
		return {
			emailError: () => visibleError("email"),
			emailInvalid: () => visibleError("email") !== null,
			passwordError: () => visibleError("password"),
			passwordInvalid: () => visibleError("password") !== null,
			confirmError: () => visibleError("confirm"),
			confirmInvalid: () => visibleError("confirm") !== null,
			termsError: () => visibleError("terms"),
			termsInvalid: () => visibleError("terms") !== null,
			strength: () => passwordScore(state.password),
			strengthLabel: () =>
				["Too short", "Weak", "Fair", "Good", "Strong"][
					passwordScore(state.password)
				],
			summary: () => {
				const count = invalidCount();
				return count === 0
					? null
					: `${count} ${count === 1 ? "field needs" : "fields need"} attention.`;
			},
			summaryHidden: () => invalidCount() === 0,
		};
	},
	actions: ({ state, setState, refs }) => ({
		input: (event: Event) => setState((draft) => assignField(draft, event)),
		touch: (event: Event) => {
			const name = fieldFrom(event)?.name;
			if (!name || !(SIGNUP_FIELDS as string[]).includes(name)) return;
			setState((draft) => {
				draft.touched[name as SignupField] = true;
			});
		},
		submit: (event: SubmitEvent) => {
			event.preventDefault();
			setState((draft) => {
				draft.submitted = true;
			});
			const errors = validateSignup(state);
			const firstInvalid = SIGNUP_FIELDS.find(
				(field) => errors[field] !== null,
			);
			if (firstInvalid) {
				signupLog.warn(`Submit blocked, focusing #${firstInvalid}`, errors);
				refs.get<HTMLInputElement>(firstInvalid)?.focus();
				return;
			}
			signupLog.success("Valid, would submit", {
				email: state.email,
				terms: state.terms,
			});
		},
		reset: () =>
			setState((draft) => {
				draft.submitted = false;
				draft.touched = {
					email: false,
					password: false,
					confirm: false,
					terms: false,
				};
				draft.email = "";
				draft.password = "";
				draft.confirm = "";
				draft.terms = false;
			}),
	}),
});

// --------------------------------------------------------
// Async submit

const contactLog = createLogger("contact");

const contact = defineStore({
	state: {
		name: "",
		message: "",
		status: "idle" as "idle" | "sending" | "sent" | "failed",
		failNext: false,
		payload: null as Record<string, string> | null,
	},
	computed: ({ state }) => ({
		sending: () => state.status === "sending",
		buttonLabel: () =>
			state.status === "sending" ? "Sending…" : "Send message",
		statusText: () =>
			state.status === "sent"
				? "Message sent. The form has been cleared."
				: state.status === "failed"
					? "The server rejected the message. Your text is kept so you can try again."
					: "",
		statusHidden: () => state.status === "idle" || state.status === "sending",
		payloadJson: () =>
			state.payload ? json(state.payload) : "Nothing sent yet",
	}),
	actions: ({ state, setState }) => ({
		input: (event: Event) => setState((draft) => assignField(draft, event)),
		submit: async (event: SubmitEvent) => {
			event.preventDefault();
			if (state.status === "sending") {
				contactLog.warn("Ignored a second submit while sending");
				return;
			}
			const form = event.currentTarget as HTMLFormElement;
			const payload = Object.fromEntries(
				Array.from(new FormData(form), ([key, value]) => [
					key,
					typeof value === "string" ? value : value.name,
				]),
			);
			setState((draft) => {
				draft.status = "sending";
				draft.payload = payload;
			});
			contactLog.info("Sending", payload);
			await wait(1200);
			if (state.failNext) {
				setState((draft) => {
					draft.status = "failed";
				});
				contactLog.error("Server returned 500");
				return;
			}
			setState((draft) => {
				draft.status = "sent";
				draft.name = "";
				draft.message = "";
			});
			contactLog.success("Sent");
		},
	}),
});

// --------------------------------------------------------
// Field arrays

const invoiceLog = createLogger("invoice");

type Line = { description: string; qty: number | null; price: number | null };

const invoice = defineStore({
	state: {
		lines: [
			{ description: "Design", qty: 2, price: 450 },
			{ description: "Build", qty: 5, price: 600 },
			{ description: "Hosting", qty: 12, price: 15 },
		] as Line[],
	},
	computed: ({ state }) => ({
		total: () =>
			money.format(
				state.lines.reduce(
					(sum, item) => sum + (item.qty ?? 0) * (item.price ?? 0),
					0,
				),
			),
		count: () =>
			`${state.lines.length} ${state.lines.length === 1 ? "line" : "lines"}`,
		hasLines: () => state.lines.length > 0,
	}),
	actions: ({ state, setState, refs }) => ({
		// Actions inside the loop receive the line they were called from.
		amount: ({ item }: LoopItem<Line>) =>
			money.format((item.qty ?? 0) * (item.price ?? 0)),
		removeLine: (_event: Event, { index, item }: LoopItem<Line>) => {
			invoiceLog.info(`Removed line ${index + 1}`, snapshot(item));
			setState((draft) => {
				draft.lines.splice(index, 1);
			});
		},
		addLine: () => {
			setState((draft) => {
				draft.lines.push({ description: "", qty: 1, price: 0 });
			});
			// Apply the write so the new row exists, then focus it.
			flush();
			refs.all<HTMLInputElement>("descriptions").at(-1)?.focus();
		},
		reverse: () =>
			setState((draft) => {
				draft.lines.reverse();
			}),
		submit: (event: SubmitEvent) => {
			event.preventDefault();
			invoiceLog.success("Invoice submitted", snapshot(state.lines));
		},
	}),
});

// --------------------------------------------------------
// Multi-step form

const wizardLog = createLogger("wizard");

const wizard = defineStore({
	state: {
		step: 1,
		navigated: false,
		name: "",
		email: "",
		plan: "starter",
		notes: "",
	},
	computed: ({ state }) => {
		const stepValid = () =>
			state.step !== 1 ||
			(state.name.trim() !== "" && state.email.includes("@"));
		return {
			step1Hidden: () => state.step !== 1,
			step2Hidden: () => state.step !== 2,
			step3Hidden: () => state.step !== 3,
			// Focus moves to a step's heading after navigating, not on load.
			focusStep1: () => state.navigated && state.step === 1,
			focusStep2: () => state.navigated && state.step === 2,
			focusStep3: () => state.navigated && state.step === 3,
			step1Current: () => (state.step === 1 ? "step" : null),
			step2Current: () => (state.step === 2 ? "step" : null),
			step3Current: () => (state.step === 3 ? "step" : null),
			step1Done: () => state.step > 1,
			step2Done: () => state.step > 2,
			backHidden: () => state.step === 1,
			nextHidden: () => state.step === 3,
			submitHidden: () => state.step !== 3,
			nextDisabled: () => !stepValid(),
			progress: () => `Step ${state.step} of 3`,
		};
	},
	actions: ({ state, setState }) => {
		const go = (step: number) =>
			setState((draft) => {
				draft.step = step;
				draft.navigated = true;
			});
		return {
			input: (event: Event) => setState((draft) => assignField(draft, event)),
			back: () => go(Math.max(1, state.step - 1)),
			next: () => {
				if (
					state.step === 1 &&
					!(state.name.trim() && state.email.includes("@"))
				)
					return;
				go(Math.min(3, state.step + 1));
			},
			// Enter in a field submits the form, which moves to the next step
			// until the last one.
			submit: (event: SubmitEvent) => {
				event.preventDefault();
				if (state.step < 3) {
					if (
						state.step === 1 &&
						!(state.name.trim() && state.email.includes("@"))
					)
						return;
					go(state.step + 1);
					return;
				}
				wizardLog.success("Submitted", {
					name: state.name,
					email: state.email,
					plan: state.plan,
					notes: state.notes,
				});
				setState((draft) => {
					draft.step = 1;
					draft.navigated = true;
					draft.name = "";
					draft.email = "";
					draft.plan = "starter";
					draft.notes = "";
				});
			},
		};
	},
});

// --------------------------------------------------------
// Native reset

const resettable = defineStore({
	state: { title: "Quarterly report", owner: "Ada" },
	computed: ({ state }) => ({
		json: () => json({ title: state.title, owner: state.owner }),
	}),
	actions: ({ setState }) => ({
		input: (event: Event) => setState((draft) => assignField(draft, event)),
	}),
});

// --------------------------------------------------------
// Server-rendered values

const accountLog = createLogger("account");

const account = defineStore({
	state: {
		displayName: "",
		email: "",
		role: "viewer",
		seats: 1,
		marketing: false,
	},
	actions: ({ state, setState }) => ({
		input: (event: Event) => setState((draft) => assignField(draft, event)),
		save: (event: SubmitEvent) => {
			event.preventDefault();
			accountLog.success("Saved", snapshot(state));
		},
	}),
	init: ({ state }) => {
		accountLog.info("Started from the server-rendered attributes", {
			...snapshot(state),
			"typeof seats": typeof state.seats,
			"typeof marketing": typeof state.marketing,
		});
	},
});

startCatalyst({
	stores: {
		profile,
		modelled,
		choices,
		selects,
		address,
		signup,
		contact,
		invoice,
		wizard,
		resetModel: resettable,
		resetOneWay: resettable,
		account,
	},
});

// --------------------------------------------------------
// Readouts of what the fields actually show, read straight from the DOM.

for (const readout of document.querySelectorAll<HTMLElement>(
	"[data-field-readout]",
)) {
	const scope = readout.closest("[data-scenario]");
	const selectors = (readout.dataset.fieldReadout ?? "").split(",");
	const render = () => {
		const lines = selectors.map((selector) => {
			const fields = Array.from(
				scope?.querySelectorAll<FieldElement>(selector.trim()) ?? [],
			);
			const values = fields.map((field) => {
				if (
					field instanceof HTMLInputElement &&
					(field.type === "checkbox" || field.type === "radio")
				) {
					return `${field.value}: ${field.checked ? "checked" : "unchecked"}`;
				}
				if (field instanceof HTMLSelectElement && field.multiple) {
					return `[${Array.from(field.selectedOptions, (option) => option.value).join(", ")}]`;
				}
				return field.value;
			});
			return `${selector.trim()} → ${values.join(" · ") || "(none)"}`;
		});
		readout.textContent = lines.join("\n");
	};
	render();
	setInterval(render, 250);
}
