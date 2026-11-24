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

/** Writes a message to a status element, clearing it first when it already shows that message, so screen readers read it again */
const write = (status: HTMLElement, text: string) => {
	if (!S.statusNodes.has(status))
		S.statusNodes.set(status, Array.from(status.childNodes));
	if (status.textContent !== text || text === "") {
		status.textContent = text;
		return;
	}
	status.textContent = "";
	S.statusTimer = setTimeout(() => {
		S.statusTimer = undefined;
		if (S.initialised) status.textContent = text;
	}, C.repeatDelay);
};

/**
 * Confirms a decision once it has closed the alert or details element
 * - Writes the decision's message to every `data-cookie--status` element
 * - When the decision hid the element that held focus, focus moves to the first status element, as GOV.UK's cookie banner does, rather than being lost
 */
const confirm = (type: Exclude<ConsentChange["type"], "load">) => {
	const statuses = Array.from(S.elements?.statuses ?? []);
	clearTimeout(S.statusTimer);
	for (const status of statuses) write(status, lib.message(KEYS[type], status));

	const focused = document.activeElement;
	const lost =
		focused === null || focused === document.body || !isShown(focused);
	const target = statuses.find(isShown);
	if (lost && target) target.focus();
};

export default confirm;
