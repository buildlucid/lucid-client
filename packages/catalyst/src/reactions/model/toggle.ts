/**
 * Elements that open and close: a `<dialog>`, a `<details>` or a `popover`.
 * `data-model` keeps their open state and a boolean state value in sync.
 */
export type ToggleElement = HTMLElement;

// Checked before use, so fields still bind in browsers without them.
const isDialog = (element: Element): element is HTMLDialogElement =>
	typeof HTMLDialogElement === "function" &&
	element instanceof HTMLDialogElement;

export const isDetails = (element: Element): element is HTMLDetailsElement =>
	typeof HTMLDetailsElement === "function" &&
	element instanceof HTMLDetailsElement;

const isPopover = (element: Element): element is HTMLElement =>
	element instanceof HTMLElement &&
	element.hasAttribute("popover") &&
	typeof element.showPopover === "function";

export const isToggle = (element: Element): element is ToggleElement =>
	isDialog(element) || isDetails(element) || isPopover(element);

export const isOpen = (element: ToggleElement) =>
	isDialog(element) || isDetails(element)
		? element.open
		: element.matches(":popover-open");

/**
 * Opens or closes the element. A dialog opens as a modal, so the rest of the
 * page is inert and `Escape` closes it, including one the markup rendered
 * open without being modal.
 */
export const setOpen = (element: ToggleElement, open: boolean) => {
	if (isDialog(element)) {
		if (!open) {
			if (element.open) element.close();
			return;
		}
		if (element.matches(":modal")) return;
		if (element.open) element.close();
		element.showModal();
		return;
	}
	if (isOpen(element) === open) return;
	if (isDetails(element)) element.open = open;
	else if (open) element.showPopover();
	else element.hidePopover();
};

/**
 * Calls `onChange` when the element opens or closes by other means, such as
 * `Escape`, a light dismiss, a `<form method="dialog">` or its summary.
 * Dialogs report closing with `close`, and opening with `toggle` where
 * browsers support it.
 */
export const observeToggle = (element: ToggleElement, onChange: () => void) => {
	element.addEventListener("toggle", onChange);
	element.addEventListener("close", onChange);
	return () => {
		element.removeEventListener("toggle", onChange);
		element.removeEventListener("close", onChange);
	};
};
