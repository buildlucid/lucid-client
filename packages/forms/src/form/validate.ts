import C from "../constants.js";
import S from "../state.js";
import type { Control } from "../types.js";
import { type Context, warnOnce } from "./context.js";
import { controlsOf, fieldsOf, labelOf, wrapperOf } from "./dom.js";
import { checkFiles } from "./file-checks.js";
import { type Failure, failureMessage } from "./messages.js";

const A = C.attributes;

/** Each native validity flag, the message key it uses and the attribute its limit comes from */
const NATIVE: Array<[keyof ValidityState, string, string?]> = [
	["valueMissing", "required"],
	["badInput", "type"],
	["typeMismatch", "type"],
	["patternMismatch", "pattern"],
	["tooShort", "minlength", "minlength"],
	["tooLong", "maxlength", "maxlength"],
	["rangeUnderflow", "min", "min"],
	["rangeOverflow", "max", "max"],
	["stepMismatch", "step", "step"],
];

/**
 * The first native constraint a control fails, such as `required` or
 * `pattern`. A custom validity the page set itself, such as from its own
 * availability check, fails with the page's message.
 */
const nativeFailure = (control: Control): Failure | null => {
	const { validity } = control;
	if (validity.valid) return null;
	for (const [flag, key, limit] of NATIVE) {
		if (!validity[flag]) continue;
		return {
			key,
			tokens: { limit: limit ? (control.getAttribute(limit) ?? "") : "" },
			native: control.validationMessage,
		};
	}
	if (validity.customError)
		return { key: "custom", tokens: {}, text: control.validationMessage };
	return null;
};

/**
 * Clears the custom validity the library set on controls, leaving any the
 * page set itself. A disabled or read-only control doesn't report its message,
 * so it stays the library's to clear later, unless `force`, such as on destroy.
 */
export const releaseValidity = (
	ctx: Context,
	controls: Iterable<Control>,
	force = false,
) => {
	for (const control of controls) {
		const set = ctx.validity.get(control);
		if (set === undefined) continue;
		if (!control.willValidate && !force) continue;
		ctx.validity.delete(control);
		if (!control.willValidate || control.validationMessage === set)
			control.setCustomValidity("");
	}
};

/** The value a value check reads: a box's value only while it is ticked, and nothing for a file input */
const valueOf = (control: Control) => {
	if (control instanceof HTMLInputElement) {
		if (control.type === "file") return "";
		if (control.type === "checkbox" || control.type === "radio")
			return control.checked ? control.value : "";
	}
	return control.value;
};

const readInt = (element: Element | null, attribute: string) =>
	Number.parseInt(element?.getAttribute(attribute) ?? "", 10);

/** Runs the `data-form--rule` rules on a control, which skip empty values like every value check */
const ruleFailure = (
	ctx: Context,
	control: Control,
	controls: Control[],
): Failure | null => {
	const names = (control.getAttribute(A.rule) ?? "").split(/\s+/);
	for (const name of names) {
		if (!name) continue;
		const rule = S.settings.rules[name];
		if (!rule) {
			warnOnce(
				ctx,
				`There is no rule named "${name}". Pass it to init with the rules option.`,
			);
			continue;
		}
		const result = rule(valueOf(control), {
			control,
			controls,
			form: ctx.form,
		});
		if (result === false) return { key: name, tokens: {} };
		if (typeof result === "string" && result !== "")
			return { key: name, tokens: {}, text: result };
	}
	return null;
};

/**
 * The first of the library's own checks a field fails, once its native
 * constraints pass: file types, sizes and counts, `data-form--maxlength`,
 * ticked box counts, `data-form--match` and `data-form--rule`
 */
const customFailure = (
	ctx: Context,
	controls: Control[],
	wrapper: Element | null,
): [Failure, Control] | null => {
	for (const control of controls) {
		if (control instanceof HTMLInputElement && control.type === "file") {
			const failure = checkFiles(control);
			if (failure) return [failure, control];
		}
	}

	const boxes = controls.filter(
		(control): control is HTMLInputElement =>
			control instanceof HTMLInputElement && control.type === "checkbox",
	);
	const first = boxes[0];
	if (first) {
		const checked = boxes.filter((box) => box.checked).length;
		const min = readInt(wrapper, A.minChecked);
		const max = readInt(wrapper, A.maxChecked);
		if (min > 0 && checked < min)
			return [{ key: "minChecked", tokens: { limit: min } }, first];
		if (max > 0 && checked > max)
			return [{ key: "maxChecked", tokens: { limit: max } }, first];
	}

	for (const control of controls) {
		const value = valueOf(control);
		if (value === "") continue;

		const limit = readInt(control, A.maxlength);
		if (
			limit > 0 &&
			!(control instanceof HTMLSelectElement) &&
			value.length > limit
		)
			return [{ key: "maxlength", tokens: { limit } }, control];

		const match = control.getAttribute(A.match);
		if (match) {
			const targets = controlsOf(ctx, match);
			// The chosen radio or ticked box of a group, or the field's value.
			const target = targets.map(valueOf).find((text) => text !== "") ?? "";
			if (targets.length > 0 && target !== value)
				return [
					{
						key: "match",
						tokens: { limit: labelOf(ctx, match, targets) },
					},
					control,
				];
		}

		const failure = ruleFailure(ctx, control, controls);
		if (failure) return [failure, control];
	}
	return null;
};

/**
 * Checks one field and returns its messages, or none when it passes. Failures
 * of the library's own checks are set as the control's custom validity, so
 * `:invalid` and `checkValidity()` agree with the messages shown.
 */
export const checkField = (
	ctx: Context,
	name: string,
	controls: Control[],
): string[] => {
	releaseValidity(ctx, controls);
	const active = controls.filter((control) => control.willValidate);
	if (active.length === 0) return [];

	const wrapper = wrapperOf(ctx, name);
	const label = labelOf(ctx, name, controls);
	const write = (failure: Failure, control: Control) =>
		failureMessage({ ...failure, tokens: { label, ...failure.tokens } }, [
			control,
			wrapper,
		]);

	for (const control of active) {
		const failure = nativeFailure(control);
		if (failure) return [write(failure, control)];
	}

	const custom = customFailure(ctx, active, wrapper);
	if (!custom) return [];
	const [failure, control] = custom;
	const text = write(failure, control);
	control.setCustomValidity(text);
	ctx.validity.set(control, text);
	return [text];
};

/** Checks every field, returning the messages of those that fail, in the order the fields appear */
export const checkFields = (ctx: Context) => {
	// Built from entries, so a field named `__proto__` is an own key like any other.
	const errors: Array<[string, string[]]> = [];
	for (const [name, controls] of fieldsOf(ctx)) {
		const messages = checkField(ctx, name, controls);
		if (messages.length > 0) errors.push([name, messages]);
	}
	return Object.fromEntries(errors);
};
