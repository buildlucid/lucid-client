import Catalyst from "../../runtime/catalyst.js";
import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";

type ActiveTrap = {
	target: HTMLElement;
	previousFocus: HTMLElement | null;
	addedTabIndex: boolean;
};

const FOCUSABLE = [
	"a[href]",
	"area[href]",
	"button:not([disabled])",
	'input:not([disabled]):not([type="hidden"])',
	"select:not([disabled])",
	"textarea:not([disabled])",
	"iframe",
	"audio[controls]",
	"video[controls]",
	'[contenteditable]:not([contenteditable="false"])',
	'[tabindex]:not([tabindex="-1"])',
].join(",");

const SKIPPED_ELEMENTS = new Set([
	"script",
	"style",
	"template",
	"link",
	"meta",
]);

/** Active traps, innermost last. Only the innermost trap is interactive. */
const stack: ActiveTrap[] = [];
/** Elements Catalyst made inert, so only those are restored. */
const inertElements = new Set<Element>();
let previousOverflow: string | null = null;

/** Elements marked `data-trap-allow` stay interactive while a trap is active. */
const getAllowAttribute = () =>
	`${Catalyst.options.attributes.prefix}trap-allow`;

const restoreInert = () => {
	for (const element of inertElements) element.removeAttribute("inert");
	inertElements.clear();
};

/**
 * Makes everything outside the kept elements inert, at every level of the
 * tree, so the trap holds even when it is nested deep inside the page.
 */
const inertOutside = (kept: Element[]) => {
	const visit = (parent: Element) => {
		for (const child of Array.from(parent.children)) {
			if (kept.includes(child)) continue;
			if (kept.some((element) => child.contains(element))) {
				visit(child);
				continue;
			}
			if (SKIPPED_ELEMENTS.has(child.localName)) continue;
			if (child.hasAttribute("inert")) continue;
			child.setAttribute("inert", "");
			inertElements.add(child);
		}
	};
	visit(document.body);
};

const applyStack = () => {
	restoreInert();
	const top = stack.at(-1);
	if (!top || !document.body.contains(top.target)) return;
	const allowed = Array.from(
		document.body.querySelectorAll(`[${getAllowAttribute()}]`),
	);
	inertOutside([top.target, ...allowed]);
};

const focusTrap = (trap: ActiveTrap) => {
	const { target } = trap;
	if (document.activeElement && target.contains(document.activeElement)) return;

	const autofocus = target.querySelector<HTMLElement>("[autofocus]");
	const focusable = target.matches(FOCUSABLE)
		? target
		: target.querySelector<HTMLElement>(FOCUSABLE);
	const next = autofocus ?? focusable;
	if (next) {
		next.focus();
		return;
	}

	if (!target.hasAttribute("tabindex")) {
		target.setAttribute("tabindex", "-1");
		trap.addedTabIndex = true;
	}
	target.focus();
};

const restoreFocus = (element: HTMLElement | null) => {
	if (!element || !element.isConnected || element.closest("[inert]")) return;
	element.focus();
};

const activateTrap = (target: HTMLElement) => {
	if (stack.some((trap) => trap.target === target)) return;

	if (stack.length === 0) {
		previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
	}

	const trap: ActiveTrap = {
		target,
		previousFocus:
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null,
		addedTabIndex: false,
	};
	stack.push(trap);
	target.removeAttribute("inert");
	applyStack();
	// Focus moves once the rest of this update has run, so a binding that
	// shows the trap, such as data-bind--hidden, applies first wherever it is
	// in the markup.
	queueMicrotask(() => {
		if (stack.at(-1) === trap) focusTrap(trap);
	});
};

const releaseTrap = (target: HTMLElement) => {
	const index = stack.findIndex((trap) => trap.target === target);
	if (index === -1) return;

	const [trap] = stack.splice(index, 1);
	const wasInnermost = index === stack.length;
	if (trap?.addedTabIndex) target.removeAttribute("tabindex");
	applyStack();

	if (stack.length === 0) {
		document.body.style.overflow = previousOverflow ?? "";
		previousOverflow = null;
	}
	if (wasInnermost) restoreFocus(trap?.previousFocus ?? null);
};

const trapReaction: Reaction = {
	name: "trap",
	attribute: "trap",
	setup: (directive, context) => {
		if (!(directive.element instanceof HTMLElement)) {
			context.warn(
				`The "${directive.attributeName}" directive requires an HTML element.`,
			);
			return;
		}
		if (directive.reference?.type === "identifier") {
			context.warn(
				`The "${directive.attributeName}" directive requires state or an action.`,
			);
			return;
		}

		const target = directive.element;
		const inertWhenInactive = directive.specifier.split(".").includes("both");
		createResolvedEffect(directive, context, (value) => {
			if (value) {
				activateTrap(target);
				return;
			}
			releaseTrap(target);
			if (inertWhenInactive) target.setAttribute("inert", "");
		});

		return () => releaseTrap(target);
	},
};

export default trapReaction;
