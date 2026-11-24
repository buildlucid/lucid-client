/**
 * The values a message can use. Templates write them as `{label}`, `{limit}`, `{file}` and `{count}`.
 * - `label` is the field's label, `limit` the value of the constraint that failed, `file` a file's name and `count` a number such as the characters left
 */
export type MessageTokens = {
	label?: string;
	limit?: string | number;
	file?: string;
	count?: number;
};

/** A template such as `"Enter {label}"`, or a function for text that changes with a number */
export type Message = string | ((tokens: MessageTokens) => string);

export type Messages = {
	/** `null` uses the browser's own message for the constraint, which is in the visitor's language */
	required: Message | null;
	type: Message | null;
	pattern: Message | null;
	minlength: Message | null;
	maxlength: Message | null;
	min: Message | null;
	max: Message | null;
	step: Message | null;
	/** A file that doesn't match the input's `accept` */
	accept: Message;
	/** A file larger than `data-form--max-size` */
	maxSize: Message;
	/** A file smaller than `data-form--min-size` */
	minSize: Message;
	/** More files than `data-form--max-files` */
	maxFiles: Message;
	/** Fewer boxes ticked than `data-form--min-checked` */
	minChecked: Message;
	/** More boxes ticked than `data-form--max-checked` */
	maxChecked: Message;
	/** A value that differs from the field `data-form--match` names */
	match: Message;
	/** A custom rule that returned `false` */
	rule: Message;
	/** Read before each inline error by screen readers, from a visually hidden span. `""` leaves it out. */
	errorPrefix: Message;
	/** The status after client-side checks fail, when the form has no error summary */
	invalid: Message;
	/** The status while the form is being sent */
	submitting: Message;
	/** The status after sending, when the response has no message of its own */
	success: Message;
	/** The status after a failed send, when the response has no message of its own */
	error: Message;
	/** A character count under its limit */
	remaining: Message;
	/** A character count over its limit */
	over: Message;
	/** The label of a file list's remove buttons, when they have no label of their own */
	remove: Message;
	/** Announced when files are dropped */
	added: Message;
	/** Announced when a file is removed from a list */
	removed: Message;
};

/** The controls the library validates */
export type Control =
	| HTMLInputElement
	| HTMLSelectElement
	| HTMLTextAreaElement;

export type RuleContext = {
	/** The control the rule is on */
	control: Control;
	/** Every control in the field, such as each checkbox in a group */
	controls: Control[];
	form: HTMLFormElement;
};

/**
 * A custom check, named by `data-form--rule`. Return a message, or `false` to use the field's
 * `data-form--message-{rule}` or the `rule` message. Anything else passes.
 */
export type Rule = (
	value: string,
	context: RuleContext,
) => string | boolean | null | undefined;

/**
 * What a response means for the form. The default parser reads `message`, `redirect` and `errors`
 * from JSON, and `parse` or `send` can return one for anything else.
 */
export type FormResult = {
	/** Whether the form was accepted */
	ok: boolean;
	/** Text for the status, or for an empty `data-form--sent` element */
	message?: string;
	/** Refused answers by field name. Names like `files.0` and `topics[]` are matched to their field. */
	errors?: Record<string, string | string[]>;
	/** A page to go to after sending */
	redirect?: string;
	/** The response body, for event listeners */
	data?: unknown;
};

export type FormStatus = "idle" | "submitting" | "success" | "error";

export type FormState = {
	/** `submitting` while sending, then `success` or `error` until the next send or reset */
	status: FormStatus;
	/** The messages shown for each field, by field name without a trailing `[]` */
	errors: Record<string, string[]>;
	/** The last status message, such as a success message or a server error */
	message: string;
	/** Whether any field has changed since the page loaded or the form was reset */
	dirty: boolean;
};

export type Form = {
	/** The `data-form` element */
	readonly element: HTMLFormElement;
	/** The current state, as a copy */
	readonly state: FormState;
	/**
	 * Checks and sends the form, as its submit button does. Resolves with the result, or `null`
	 * when nothing was sent, such as when a field is invalid or the form submits natively.
	 */
	submit: () => Promise<FormResult | null>;
	/** Checks every field, or one by name, and shows their errors. Returns whether they passed. */
	validate: (name?: string) => boolean;
	/** Resets the form, as a reset button does */
	reset: () => void;
	/** Shows errors, such as ones from your own checks. Moves focus to them unless `focus` is `false`. */
	setErrors: (
		errors: Record<string, string | string[]>,
		options?: { focus?: boolean },
	) => void;
	/** Clears the errors of every field, or one by name */
	clearErrors: (name?: string) => void;
	/** Runs the listener after every state change. Returns a function that removes it. */
	subscribe: (listener: (state: FormState) => void) => () => void;
	/** Reads the markup again, such as after adding a character count or a file list */
	refresh: () => void;
	/** Removes the listeners and everything the library added to the markup */
	destroy: () => void;
};

export type ExtensionContext = {
	/** Aborted when the form is destroyed */
	signal: AbortSignal;
	/** The elements inside the form that match a selector */
	owned: <E extends Element = HTMLElement>(selector: string) => E[];
	/** Reads a message out to screen readers without showing it */
	announce: (message: string) => void;
	/**
	 * Writes one of the library's messages: a `data-form--message-{key}` attribute on `from`, an
	 * element around it or the form, or else the options passed to `init`
	 */
	message: (
		key: keyof Messages,
		tokens?: MessageTokens,
		from?: Element,
	) => string;
};

export type ExtensionInstance = {
	/** Runs when the form is refreshed */
	refresh?: () => void;
	/** Runs when the form is destroyed */
	destroy?: () => void;
};

/** Adds behaviour to every form, such as file drop zones or a captcha provider */
export type Extension = {
	name: string;
	setup: (form: Form, context: ExtensionContext) => ExtensionInstance | void;
};

export type Options = {
	/**
	 * Text the library writes, for translating or rewording. `data-form--message-{key}` attributes
	 * in the markup win over these.
	 */
	messages?: Partial<Messages>;
	/** Custom checks, named by `data-form--rule` */
	rules?: Record<string, Rule>;
	/** Extensions such as `files` from `@lucidclient/forms/files` */
	extensions?: Extension[];
	/**
	 * Sends the request instead of `fetch`, such as to add a header. Return the `Response`, or a
	 * `FormResult` for sends that don't use HTTP.
	 */
	send?: (request: Request, form: Form) => Promise<Response | FormResult>;
	/** Reads a response instead of the default parser */
	parse?: (response: Response, form: Form) => Promise<FormResult>;
};

export type FormSubmitDetail = {
	/** What will be sent. Listeners can add to or change it. */
	data: FormData;
	/** The button that submitted the form, if any */
	submitter: HTMLElement | null;
};

export type FormResultDetail = {
	result: FormResult;
	/** The response, or `null` when the request failed or `send` returned a result */
	response: Response | null;
	/** What went wrong, when the request failed */
	error?: unknown;
};

export type FormInvalidDetail = {
	errors: Record<string, string[]>;
};

declare global {
	interface HTMLElementEventMap {
		"form-submit": CustomEvent<FormSubmitDetail>;
		"form-success": CustomEvent<FormResultDetail>;
		"form-error": CustomEvent<FormResultDetail>;
		"form-invalid": CustomEvent<FormInvalidDetail>;
	}
	interface DocumentEventMap {
		"form-submit": CustomEvent<FormSubmitDetail>;
		"form-success": CustomEvent<FormResultDetail>;
		"form-error": CustomEvent<FormResultDetail>;
		"form-invalid": CustomEvent<FormInvalidDetail>;
	}
}
