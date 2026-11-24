import type { Messages, MessageTokens } from "./types.js";

const plural = (count: number | string, one: string, many: string) =>
	Number(count) === 1 ? one : many;

export default {
	/**
	 * Every attribute follows the suite's `data-{namespace}--{specifier}` grammar, with `form` as the namespace
	 */
	attributes: {
		// Elements
		root: "data-form",
		field: "data-form--field",
		error: "data-form--error",
		status: "data-form--status",
		summary: "data-form--summary",
		sent: "data-form--sent",
		count: "data-form--count",
		captcha: "data-form--captcha",
		honeypot: "data-form--honeypot",
		dropzone: "data-form--dropzone",
		files: "data-form--files",
		remove: "data-form--remove",
		// Options, read from the form when they are used
		validate: "data-form--validate",
		submit: "data-form--submit",
		reset: "data-form--reset",
		redirect: "data-form--redirect",
		// Field constraints and messages, read from controls and field wrappers
		message: "data-form--message",
		messagePrefix: "data-form--message-",
		match: "data-form--match",
		rule: "data-form--rule",
		maxlength: "data-form--maxlength",
		maxSize: "data-form--max-size",
		minSize: "data-form--min-size",
		maxFiles: "data-form--max-files",
		minChecked: "data-form--min-checked",
		maxChecked: "data-form--max-checked",
		// State, written by the library
		ready: "data-form--ready",
		state: "data-form--state",
		invalid: "data-form--invalid",
		over: "data-form--over",
		dragging: "data-form--dragging",
		hasFiles: "data-form--has-files",
	},
	events: {
		submit: "form-submit",
		success: "form-success",
		error: "form-error",
		invalid: "form-invalid",
		/** Fired on each `data-form--captcha` element before sending. Its `detail` takes a promise for the form to wait on. */
		captchaToken: "captcha:token",
		/** Fired on each `data-form--captcha` element after sending, as tokens only work once */
		captchaReset: "captcha:reset",
	},
	/** Milliseconds a send waits for captcha widgets to hand over their tokens */
	captchaTimeout: 30000,
	/** Milliseconds of no typing before a character count is announced */
	countDelay: 1000,
	/** Milliseconds an announcement waits after clearing a live region, so a repeated message is read again */
	repeatDelay: 100,
	/**
	 * The text the library writes. `null` uses the browser's own message, which is already in the visitor's language.
	 * Templates take `{label}`, `{limit}`, `{file}` and `{count}`, and functions receive the same values.
	 */
	messages: {
		required: null,
		type: null,
		pattern: null,
		minlength: null,
		maxlength: null,
		min: null,
		max: null,
		step: null,
		accept: "{file} is not an accepted file type",
		maxSize: "{file} must be smaller than {limit}",
		minSize: "{file} must be larger than {limit}",
		maxFiles: ({ limit = 0 }: MessageTokens) =>
			`Select up to ${limit} ${plural(limit, "file", "files")}`,
		minChecked: ({ limit = 0 }: MessageTokens) =>
			`Select at least ${limit} ${plural(limit, "option", "options")}`,
		maxChecked: ({ limit = 0 }: MessageTokens) =>
			`Select no more than ${limit} ${plural(limit, "option", "options")}`,
		match: "{label} must match {limit}",
		rule: "{label} is not valid",
		invalid: ({ count = 0 }: MessageTokens) =>
			plural(
				count,
				"There is a problem with 1 answer. Check the form and try again.",
				`There are problems with ${count} answers. Check the form and try again.`,
			),
		submitting: "Sending…",
		success: "Thank you, your form has been sent.",
		error: "Your form couldn't be sent. Try again.",
		remaining: ({ count = 0 }: MessageTokens) =>
			`You have ${count} ${plural(count, "character", "characters")} remaining`,
		over: ({ count = 0 }: MessageTokens) =>
			`You have ${count} ${plural(count, "character", "characters")} too many`,
		remove: "Remove {file}",
		added: ({ count = 0, file = "" }: MessageTokens) =>
			plural(count, `Added ${file}`, `Added ${count} files`),
		removed: "Removed {file}",
	} satisfies Messages as Messages,
	/** Used for limits that have no browser message, such as `data-form--maxlength` */
	fallbacks: {
		maxlength: ({ label = "", limit = 0 }: MessageTokens) =>
			`${label} must be ${limit} ${plural(limit, "character", "characters")} or fewer`,
	},
} as const;
