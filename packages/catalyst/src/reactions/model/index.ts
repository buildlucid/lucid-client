import { untrack } from "solid-js";
import Catalyst from "../../runtime/catalyst.js";
import { flushUpdates } from "../../runtime/reactive.js";
import type {
	Directive,
	MemberReference,
	Reaction,
	ReactionContext,
} from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";
import {
	type FieldElement,
	isCheckable,
	isField,
	observeOptions,
	readFieldValue,
	setFieldValue,
	toText,
} from "../utils/fields.js";
import {
	DEFAULT_WAIT,
	debounce,
	parseDuration,
	splitModifiers,
} from "../utils/modifiers.js";
import {
	isDetails,
	isOpen,
	isToggle,
	observeToggle,
	setOpen,
} from "./toggle.js";

/** Where a model reads and writes its value. */
type ModelTarget = {
	read: () => unknown;
	write: (value: unknown) => void;
};

/** An unchecked radio has nothing to write. */
const SKIP = Symbol("skip");

/** Sets the value at `path` inside `target`, if every part before it exists. */
const assignPath = (target: unknown, path: string[], value: unknown) => {
	let current = target;
	for (const key of path.slice(0, -1)) {
		if (typeof current !== "object" || current === null) return false;
		current = (current as Record<string, unknown>)[key];
	}
	const last = path.at(-1);
	if (last === undefined || typeof current !== "object" || current === null) {
		return false;
	}
	(current as Record<string, unknown>)[last] = value;
	return true;
};

const getTarget = (
	directive: Directive,
	context: ReactionContext,
): ModelTarget | null => {
	const reference = directive.reference;
	if (!reference) return null;
	const read = () => untrack(() => context.resolve(reference));

	if (reference.type === "state" && reference.scope) {
		const scope = reference.scope;
		return {
			read,
			write: (value) => {
				const store = context.getStore(scope);
				if (!store) return;
				let declared = true;
				let written = true;
				store.setState((state) => {
					if (!(reference.key in state)) {
						declared = false;
						return;
					}
					if (reference.path.length === 0) state[reference.key] = value;
					else
						written = assignPath(state[reference.key], reference.path, value);
				});
				if (!declared) {
					if (__DEV__)
						context.warn(
							`The "${directive.attributeName}" directive can only write state that store "${scope}" declares, and "${reference.key}" isn't declared state.`,
						);
				} else if (!written) {
					if (__DEV__)
						context.warn(
							`The "${directive.attributeName}" directive can't write "${reference.raw}", because part of its path doesn't exist.`,
						);
				}
			},
		};
	}

	// A property of a loop item is written through the store the loop renders.
	const loop = reference.type === "loop" ? reference.context : undefined;
	if (
		reference.type === "loop" &&
		reference.key === "item" &&
		reference.path.length > 0 &&
		loop?.scope
	) {
		const scope = loop.scope;
		return {
			read,
			write: (value) => {
				context.getStore(scope)?.setState(() => {
					assignPath(loop.item, reference.path, value);
				});
			},
		};
	}

	return null;
};

/** Text from a field, typed like the state it replaces. */
const coerce = (text: string, like: unknown): unknown => {
	if (typeof like === "number") {
		if (text.trim() === "") return null;
		const number = Number(text);
		return Number.isNaN(number) ? text : number;
	}
	if (typeof like === "boolean") {
		if (text === "true") return true;
		if (text === "false") return false;
	}
	return text;
};

const sameTarget = (left: MemberReference, right: MemberReference) => {
	if (left.key !== right.key || left.path.join(".") !== right.path.join(".")) {
		return false;
	}
	if (left.type === "loop" && right.type === "loop") {
		return left.context === right.context;
	}
	return left.type !== "loop" && right.type !== "loop"
		? left.scope === right.scope
		: false;
};

/**
 * Every checkbox or radio bound to the same state as this one, in page
 * order.
 */
const getGroup = (element: HTMLInputElement, directive: Directive) => {
	const reference = directive.reference;
	if (!reference) return [element];
	const group = Array.from(
		document.querySelectorAll<HTMLInputElement>(
			`input[type="${element.type}"][${directive.attributeName}]`,
		),
	).filter((candidate) => {
		const other = Catalyst.registrations
			.get(candidate)
			?.get(directive.attributeName)?.directive.reference;
		return other ? sameTarget(reference, other) : false;
	});
	return group.includes(element) ? group : [...group, element];
};

/**
 * The value a field holds, for the state it's bound to. `reset` is set when
 * reading fields back after a native form reset.
 */
const readField = (
	element: FieldElement,
	current: unknown,
	directive: Directive,
	reset: boolean,
): unknown => {
	if (element instanceof HTMLInputElement && element.type === "checkbox") {
		if (!Array.isArray(current)) return element.checked;
		// A checkbox bound to an array holds the values of its checked group,
		// read from the page rather than from state, so changes made in the same
		// task, such as a reset, don't read a stale array. Values no checkbox
		// represents are kept.
		const group = getGroup(element, directive);
		const represented = new Set(group.map((checkbox) => checkbox.value));
		const kept = current.filter((item) => !represented.has(toText(item)));
		const checked = group
			.filter((checkbox) => checkbox.checked)
			.map((checkbox) => coerce(checkbox.value, current[0]));
		return [...kept, ...checked];
	}
	if (element instanceof HTMLInputElement && element.type === "radio") {
		if (element.checked) return coerce(element.value, current);
		// A reset that leaves no radio of the group chosen clears the state.
		const noneChosen =
			reset && !getGroup(element, directive).some((radio) => radio.checked);
		return noneChosen ? null : SKIP;
	}
	if (element instanceof HTMLSelectElement && element.multiple) {
		const sample = Array.isArray(current) ? current[0] : undefined;
		return Array.from(element.options)
			.filter((option) => option.selected)
			.map((option) => coerce(option.value, sample));
	}
	if (
		element instanceof HTMLInputElement &&
		(element.type === "number" || element.type === "range")
	) {
		return Number.isNaN(element.valueAsNumber) ? null : element.valueAsNumber;
	}
	return coerce(element.value, current);
};

/** Shows a state value in a field. */
const showValue = (element: FieldElement, value: unknown) => {
	if (element instanceof HTMLInputElement && element.type === "checkbox") {
		element.checked = Array.isArray(value)
			? value.includes(element.value)
			: Boolean(value);
		return;
	}
	if (element instanceof HTMLInputElement && element.type === "radio") {
		element.checked = toText(value) === element.value;
		return;
	}
	setFieldValue(element, value);
};

type ModelModifiers = {
	/** Writes when the field changes, such as on blur, instead of as it is typed in. */
	lazy: boolean;
	/** Trims text before it is written. */
	trim: boolean;
	/** Waits until typing pauses for this long before writing. */
	debounce: number | null;
};

const parseModifiers = (
	directive: Directive,
	context: ReactionContext,
): ModelModifiers => {
	const modifiers: ModelModifiers = {
		lazy: false,
		trim: false,
		debounce: null,
	};
	const parts = splitModifiers(directive.specifier);
	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (part === "lazy" || part === "trim") {
			modifiers[part] = true;
		} else if (part === "debounce") {
			// An optional duration follows, such as `debounce.500ms`.
			const duration = parseDuration(parts[index + 1]);
			if (duration !== null) index += 1;
			modifiers.debounce = duration ?? DEFAULT_WAIT;
		} else if (__DEV__) {
			context.warn(
				`The "${directive.attributeName}" directive has an unknown modifier "${part}". Use lazy, trim or debounce.`,
			);
		}
	}
	return modifiers;
};

/**
 * Keeps a dialog, details or popover open while the state is truthy, and
 * writes `true` or `false` to the state when it opens or closes by other
 * means, such as `Escape`.
 */
const setUpToggle = (
	element: HTMLElement,
	directive: Directive,
	context: ReactionContext,
	target: ModelTarget,
) => {
	// Changes the binding makes itself aren't written back, such as closing a
	// dialog the markup rendered open to open it again as a modal.
	let applying = false;
	createResolvedEffect(directive, context, (value) => {
		applying = true;
		try {
			setOpen(element, Boolean(value));
		} finally {
			applying = false;
		}
	});
	const stopObserving = observeToggle(element, () => {
		if (applying) return;
		const open = isOpen(element);
		if (Boolean(target.read()) === open) return;
		target.write(open);
		flushUpdates();
	});
	// A dialog or popover left open would keep the page behind it inert after
	// `Catalyst.destroy()`, so it closes with the directive.
	return () => {
		stopObserving();
		if (element.isConnected && !isDetails(element)) {
			setOpen(element, false);
		}
	};
};

/**
 * Two-way binding: the field shows the state, and the state follows the field
 * as it is edited, and after a native form reset. A dialog, details or
 * popover is open while the state is truthy.
 */
const modelReaction: Reaction = {
	name: "model",
	attribute: "model",
	setup: (directive, context) => {
		const toggle = isToggle(directive.element) ? directive.element : null;
		const element = isField(directive.element) ? directive.element : null;
		if (!toggle && !element) {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires an input, select, textarea, dialog, details or popover.`,
				);
			return;
		}
		const target = getTarget(directive, context);
		if (!target) {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires state, such as "$name", or a property of a loop item, such as "$item.name".`,
				);
			return;
		}
		if (toggle) return setUpToggle(toggle, directive, context, target);
		if (!element) return;

		const modifiers = parseModifiers(directive, context);
		const isText =
			!isCheckable(element) && !(element instanceof HTMLSelectElement);
		let current: { value: unknown } | null = null;
		// Trimmed text this field just wrote, which it doesn't show again, so
		// the spaces being typed aren't removed from under the cursor.
		let trimmed: { value: string } | null = null;
		createResolvedEffect(
			directive,
			context,
			(value) => {
				current = { value };
				const echo = trimmed;
				trimmed = null;
				if (echo && echo.value === value) return;
				showValue(element, value);
			},
			{ read: readFieldValue },
		);

		// Each write is applied straight away, so fields sharing state, such as
		// checkboxes bound to one array, each see the previous field's change.
		const write = (reset = false) => {
			let next = readField(element, target.read(), directive, reset);
			if (next === SKIP) return;
			if (modifiers.trim && typeof next === "string") {
				trimmed = next === next.trim() ? null : { value: next.trim() };
				next = next.trim();
			}
			target.write(next);
			flushUpdates();
		};
		const delayed =
			isText && modifiers.debounce !== null
				? debounce(() => write(), modifiers.debounce)
				: null;
		const eventName = isText && !modifiers.lazy ? "input" : "change";
		const onEdit = () => {
			if (delayed) delayed.call(undefined);
			else write();
		};
		element.addEventListener(eventName, onEdit);
		// A text field that changes, such as on blur, writes its value straight
		// away and shows its trimmed text.
		const onChange = () => {
			if (delayed) {
				delayed.cancel();
				write();
			}
			if (modifiers.trim && current) showValue(element, current.value);
		};
		const settles = isText && (delayed || modifiers.trim);
		if (settles) element.addEventListener("change", onChange);
		// A form submitted while an edit waits writes it first, so the submit
		// action reads the field's value. Capturing runs before its listeners.
		const onSubmit = () => delayed?.flush();
		const submitted = delayed ? element.form : null;
		submitted?.addEventListener("submit", onSubmit, true);

		// A reset changes fields without firing input events, and only once the
		// reset event has finished, so state is read back on the next task.
		const form = element.form;
		let resetTimer: ReturnType<typeof setTimeout> | undefined;
		const onReset = () => {
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => write(true), 0);
		};
		form?.addEventListener("reset", onReset);

		const stopObserving =
			element instanceof HTMLSelectElement
				? observeOptions(element, () => {
						if (current) showValue(element, current.value);
					})
				: undefined;

		return () => {
			element.removeEventListener(eventName, onEdit);
			if (settles) element.removeEventListener("change", onChange);
			submitted?.removeEventListener("submit", onSubmit, true);
			delayed?.cancel();
			form?.removeEventListener("reset", onReset);
			clearTimeout(resetTimer);
			stopObserving?.();
		};
	},
};

export default modelReaction;
