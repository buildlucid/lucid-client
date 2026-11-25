import C from "../constants.js";
import S from "../state.js";
import type { ConsentChange, Messages } from "../types.js";
import lib from "./index.js";

const KEYS: Record<Exclude<ConsentChange["type"], "load">, keyof Messages> = {
	accept: "accepted",
	reject: "rejected",
	save: "saved",
	update: "updated",
};

/** Whether an element is on the page and shown, so it can hold focus */
export const isShown = (element: Element) =>
	element.isConnected &&
	element.closest("[hidden]") === null &&
	(element as HTMLElement).checkVisibility?.() !== false;

/**
 * Writes a message to a status element, clearing it first when it already shows that message, so screen readers read it again
 * - Returns whether the message was cleared, and so is still to be written back
 */
const write = (status: HTMLElement, text: string) => {
	if (!S.statusNodes.has(status))
		S.statusNodes.set(status, Array.from(status.childNodes));
	if (status.textContent !== text || text === "") {
		status.textContent = text;
		return false;
	}
	status.textContent = "";
	return true;
};

/**
 * Confirms a decision once it has closed the banner or details element
 * - Writes the decision's message to every `data-cookie--status` element
 * - When the decision hid the element that held focus, focus moves to the first status element, as GOV.UK's cookie banner does, rather than being lost
 * - Repeated messages are written back together after a moment, on one timer the next decision cancels, so no status is left on an earlier decision
 * - A status styled to hide while it is empty can't take focus until its message is back, so focus is moved again then
 */
const confirm = (type: Exclude<ConsentChange["type"], "load">) => {
	const statuses = Array.from(S.elements?.statuses ?? []);
	const focusStatus = () => {
		const focused = document.activeElement;
		const lost =
			focused === null || focused === document.body || !isShown(focused);
		const target = statuses.find(isShown);
		if (lost && target) target.focus();
	};

	clearTimeout(S.statusTimer);
	S.statusTimer = undefined;
	const repeated = statuses.flatMap((status) => {
		const text = lib.message(KEYS[type], status);
		return write(status, text) ? [{ status, text }] : [];
	});
	if (repeated.length > 0) {
		S.statusTimer = setTimeout(() => {
			S.statusTimer = undefined;
			if (!S.initialised) return;
			for (const { status, text } of repeated) status.textContent = text;
			focusStatus();
		}, C.repeatDelay);
	}
	focusStatus();
};

export default confirm;
