import C from "../constants.js";
import log from "../lib/log.js";
import type {
	Control,
	ExtensionInstance,
	Form,
	FormState,
	FormStatus,
} from "../types.js";
import createRecorder, { type Recorder } from "./recorder.js";

/** One send, from asking for captcha tokens to showing the result */
export type Attempt = {
	controller: AbortController;
	/** Puts the submit buttons back, once */
	release: () => void;
};

/** What one pass over the form has looked up, so the markup is read once per pass */
export type PassCache = {
	fields: Map<string, Control[]> | null;
	/** Elements by attribute, then by the field they name */
	elements: Map<string, Map<string, HTMLElement[]>>;
};

/**
 * Everything one form keeps track of. `createForm` makes it, and the other
 * modules in this folder take it as their first argument.
 */
export type Context = {
	form: HTMLFormElement;
	/** The public object, set once it is made */
	api: Form;
	/** Every attribute and piece of content the library writes, so destroy can put them back */
	rec: Recorder;
	/** Aborted when the form is destroyed */
	abort: AbortController;
	/** The send in progress, so a reset or destroy can stop it */
	attempt: Attempt | null;
	/** Cleared at every entry point and after each pass, so markup changed between them is read again */
	cache: PassCache | null;
	state: FormState;
	subscribers: Set<(state: FormState) => void>;
	extensions: ExtensionInstance[];

	/** Messages that belong to no field, shown in the status */
	general: string[];
	/** The items generated in each error summary */
	summaryItems: Map<HTMLElement, Node[]>;
	/** A visually hidden live region for announcements that aren't shown, created when first needed */
	announcer: HTMLElement | null;
	/** The character count waiting to be announced, per count element */
	countTimers: Map<Element, ReturnType<typeof setTimeout>>;
	/** A repeated message waiting to be written again, per live region */
	liveTimers: Map<Element, ReturnType<typeof setTimeout>>;
	/** For each field, the elements whose `aria-describedby` the library added error ids to, and those ids */
	described: Map<string, Map<Element, string[]>>;
	/** For each field, the controls and wrappers the library marked invalid */
	marked: Map<string, Element[]>;
	/** Where an image button was last pressed, which a native submission that waits for a captcha sends */
	pressed: { button: HTMLInputElement; x: number; y: number } | null;
	/** The custom validity the library set on each control, so a page's own is left alone */
	validity: Map<Control, string>;
	/** Sent elements the library filled with the server's message, which are filled again on the next send */
	filled: WeakSet<Element>;
	/** Whether the status shows the library's count of answers to fix, which it keeps up to date */
	counting: boolean;

	/** Set while the library resets the form after a send, so the reset isn't treated as the visitor's */
	resetting: boolean;
	destroyed: boolean;
	/** The warnings already logged, so each is logged once per form */
	warnings: Set<string>;
};

export const createContext = (form: HTMLFormElement): Context => ({
	form,
	api: null as unknown as Form,
	rec: createRecorder(),
	abort: new AbortController(),
	attempt: null,
	cache: null,
	state: { status: "idle", errors: {}, message: "", dirty: false },
	subscribers: new Set(),
	extensions: [],

	general: [],
	summaryItems: new Map(),
	announcer: null,
	countTimers: new Map(),
	liveTimers: new Map(),
	described: new Map(),
	marked: new Map(),
	pressed: null,
	validity: new Map(),
	filled: new WeakSet(),
	counting: false,

	resetting: false,
	destroyed: false,
	warnings: new Set(),
});

/** Logs a warning, once per form */
export const warnOnce = (ctx: Context, message: string) => {
	if (ctx.warnings.has(message)) return;
	ctx.warnings.add(message);
	log("warn", message);
};

/** A copy of the state, down to each field's messages, so changing it can't change the form's own */
export const copyState = (state: FormState): FormState => ({
	...state,
	errors: Object.fromEntries(
		Object.entries(state.errors).map(([name, messages]) => [
			name,
			[...messages],
		]),
	),
});

/** Updates the state and tells subscribers, when something changed */
export const setState = (ctx: Context, patch: Partial<FormState>) => {
	const next = { ...ctx.state, ...patch };
	const changed = (Object.keys(patch) as Array<keyof FormState>).some(
		(key) => next[key] !== ctx.state[key],
	);
	if (!changed) return;
	ctx.state = next;
	for (const listener of ctx.subscribers) {
		try {
			listener(copyState(next));
		} catch (error) {
			log("error", "A subscriber threw an error.", error);
		}
	}
};

/** Sets the status and the state attribute that styles it */
export const setStatus = (ctx: Context, status: FormStatus) => {
	setState(ctx, { status });
	ctx.rec.attr(ctx.form, C.attributes.state, status);
};
