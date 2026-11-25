import C from "../constants.js";
import { baseName, fill, formElements, listen } from "../form/dom.js";
import { formatSize } from "../form/file-checks.js";
import type { Extension, ExtensionContext, Form } from "../types.js";

const A = C.attributes;
const INTERACTIVE = "a, button, input, label, select, textarea, summary";

type Rendered = { list: Element; nodes: Node[] };

const isFileInput = (element: unknown): element is HTMLInputElement =>
	element instanceof HTMLInputElement && element.type === "file";

const setFiles = (input: HTMLInputElement, files: File[]) => {
	const transfer = new DataTransfer();
	for (const file of files) transfer.items.add(file);
	input.files = transfer.files;
};

/** Adds files to a list, leaving out ones it already has */
const merge = (current: File[], added: File[]) => {
	const key = (file: File) =>
		`${file.name}:${file.size}:${file.lastModified}:${file.type}`;
	const seen = new Set(current.map(key));
	return [...current, ...added.filter((file) => !seen.has(key(file)))];
};

/**
 * Drop zones, file lists and remove buttons for one form
 * - `data-form--dropzone` adds drag and drop to the file input inside it, which stays the control people focus and use with a keyboard
 * - `data-form--files="name"` lists a field's files from its `<template>`, with `{name}`, `{size}`, `{type}` and `{index}`, and `data-form--remove` buttons
 * - Inputs with `multiple` and a file list keep their files across picks and drops, as the list can take them out again
 */
const createFiles = (form: Form, context: ExtensionContext) => {
	const root = form.element;
	const { signal, owned, announce, message } = context;
	const rendered = new Map<HTMLInputElement, Rendered[]>();
	/** Which file each remove button removes */
	const removes = new WeakMap<
		Element,
		{ input: HTMLInputElement; index: number }
	>();
	const depth = new WeakMap<Element, number>();
	/** Set while the library changes an input's files, so its own change isn't merged again */
	let changing = false;

	const inputOf = (zone: Element) =>
		Array.from(zone.querySelectorAll("input")).find(isFileInput) ?? null;

	/** The file lists of an input: named after its field, or inside its drop zone without a name */
	const listsOf = (input: HTMLInputElement) =>
		owned(`[${A.files}]`).filter((list) => {
			const name = list.getAttribute(A.files) ?? "";
			if (name) return baseName(name) === baseName(input.name);
			const zone = list.closest(`[${A.dropzone}]`);
			return zone !== null && inputOf(zone) === input;
		});

	const zonesOf = (input: HTMLInputElement) =>
		owned(`[${A.dropzone}]`).filter((zone) => inputOf(zone) === input);

	/** The file inputs the extension looks after: ones in a drop zone or with a file list */
	const managed = () => {
		const inputs = new Set<HTMLInputElement>();
		for (const zone of owned(`[${A.dropzone}]`)) {
			const input = inputOf(zone);
			if (input) inputs.add(input);
		}
		// Inputs outside the form with a `form` attribute can have a list inside it.
		for (const input of formElements(root)) {
			if (isFileInput(input) && listsOf(input).length > 0) inputs.add(input);
		}
		return inputs;
	};

	const clear = (input: HTMLInputElement) => {
		for (const { nodes } of rendered.get(input) ?? [])
			for (const node of nodes) node.parentNode?.removeChild(node);
		rendered.delete(input);
	};

	/** Writes an input's file lists, and marks its drop zones while it has files */
	const render = (input: HTMLInputElement) => {
		clear(input);
		const files = Array.from(input.files ?? []);
		const lists: Rendered[] = [];
		for (const list of listsOf(input)) {
			const template = list.querySelector("template");
			const nodes: Node[] = [];
			if (template) {
				files.forEach((file, index) => {
					const fragment = template.content.cloneNode(true) as DocumentFragment;
					const values = {
						name: file.name,
						size: formatSize(file.size),
						type: file.type,
						index: index + 1,
					};
					for (const element of fragment.querySelectorAll("*")) {
						for (const attribute of element.attributes)
							attribute.value = fill(attribute.value, values);
					}
					const walker = document.createTreeWalker(
						fragment,
						NodeFilter.SHOW_TEXT,
					);
					for (let node = walker.nextNode(); node; node = walker.nextNode())
						(node as Text).data = fill((node as Text).data, values);

					for (const button of fragment.querySelectorAll(`[${A.remove}]`)) {
						removes.set(button, { input, index });
						if (
							button instanceof HTMLButtonElement &&
							!button.hasAttribute("type")
						)
							button.type = "button";
						if (!button.hasAttribute("aria-label"))
							button.setAttribute(
								"aria-label",
								message("remove", { file: file.name }, list),
							);
					}
					nodes.push(...Array.from(fragment.childNodes));
					template.before(fragment);
				});
			}
			lists.push({ list, nodes });
		}
		rendered.set(input, lists);
		for (const zone of zonesOf(input))
			zone.toggleAttribute(A.hasFiles, files.length > 0);
	};

	/** Changes an input's files as a visitor would, so the form checks them again */
	const change = (input: HTMLInputElement, files: File[]) => {
		setFiles(input, files);
		changing = true;
		try {
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
		} finally {
			changing = false;
		}
	};

	/** The files an input has kept from earlier picks, so a new pick adds to them */
	const kept = new WeakMap<HTMLInputElement, File[]>();
	for (const input of managed()) kept.set(input, Array.from(input.files ?? []));

	/**
	 * Adds a new pick to the files an input kept. It runs for `input`, which
	 * fires first, and again for `change`, where the merge finds nothing new,
	 * so the form checks the same files it will send.
	 */
	const onPick = (event: Event) => {
		const input = event.target;
		if (!isFileInput(input) || input.form !== root) return;
		if (!managed().has(input)) return;
		const picked = Array.from(input.files ?? []);
		const previous = kept.get(input) ?? [];
		if (!changing && input.multiple && listsOf(input).length > 0) {
			// Some browsers clear the input when the picker is cancelled, which keeps the files instead.
			const next = picked.length === 0 ? previous : merge(previous, picked);
			if (next.length !== picked.length) setFiles(input, next);
		}
		kept.set(input, Array.from(input.files ?? []));
		render(input);
	};
	// On the document, for inputs outside the form, and before the form checks the files.
	for (const type of ["input", "change"])
		document.addEventListener(type, onPick, { signal, capture: true });

	listen(
		root,
		"reset",
		() => {
			// The browser empties file inputs once the reset event has been handled, so a pick
			// straight afterwards starts a new list. The lists are written again from what the
			// inputs then hold, which is also right when the reset was cancelled.
			const inputs = managed();
			for (const input of inputs) kept.set(input, []);
			setTimeout(() => {
				if (signal.aborted) return;
				for (const input of inputs) {
					kept.set(input, Array.from(input.files ?? []));
					render(input);
				}
			}, 0);
		},
		{ signal },
	);

	listen(
		root,
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const button = event.target.closest(`[${A.remove}]`);
			const target = button ? removes.get(button) : undefined;
			if (button && target) {
				event.preventDefault();
				const { input, index } = target;
				const files = Array.from(input.files ?? []);
				const [removed] = files.splice(index, 1);
				change(input, files);
				if (removed)
					announce(message("removed", { file: removed.name }, input));
				// Focus moves to the file that took its place, or the one before, or the input once none are left.
				const buttons = (rendered.get(input) ?? [])
					.flatMap(({ nodes }) => nodes)
					.flatMap((node) =>
						node instanceof Element
							? [
									...(node.matches(`[${A.remove}]`) ? [node] : []),
									...Array.from(node.querySelectorAll(`[${A.remove}]`)),
								]
							: [],
					)
					.filter(
						(element): element is HTMLElement => element instanceof HTMLElement,
					);
				(buttons[index] ?? buttons[index - 1] ?? input).focus();
				return;
			}

			// A press on an empty part of a drop zone opens the file picker, as a press on its label does.
			const zone = event.target.closest(`[${A.dropzone}]`);
			if (!zone || event.target.closest(`${INTERACTIVE}, [${A.files}]`)) return;
			const input = inputOf(zone);
			if (input && !input.disabled) input.click();
		},
		{ signal },
	);

	const zoneFor = (event: DragEvent) => {
		if (!(event.target instanceof Element)) return null;
		if (!event.dataTransfer?.types.includes("Files")) return null;
		const zone = event.target.closest(`[${A.dropzone}]`);
		const input = zone ? inputOf(zone) : null;
		return zone && input && !input.disabled ? { zone, input } : null;
	};

	const setDepth = (zone: Element, value: number) => {
		depth.set(zone, Math.max(0, value));
		zone.toggleAttribute(A.dragging, (depth.get(zone) ?? 0) > 0);
	};

	listen(
		root,
		"dragenter",
		(event) => {
			const found = zoneFor(event);
			if (!found) return;
			event.preventDefault();
			setDepth(found.zone, (depth.get(found.zone) ?? 0) + 1);
		},
		{ signal },
	);
	listen(
		root,
		"dragover",
		(event) => {
			const found = zoneFor(event);
			if (!found) return;
			// Dropping is only allowed where dragover is cancelled.
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
		},
		{ signal },
	);
	listen(
		root,
		"dragleave",
		(event) => {
			const found = zoneFor(event);
			if (found) setDepth(found.zone, (depth.get(found.zone) ?? 0) - 1);
		},
		{ signal },
	);
	listen(
		root,
		"drop",
		(event) => {
			const found = zoneFor(event);
			if (!found) return;
			event.preventDefault();
			setDepth(found.zone, 0);
			const { input } = found;
			const dropped = Array.from(event.dataTransfer?.files ?? []);
			if (dropped.length === 0) return;
			const current = Array.from(input.files ?? []);
			const next = !input.multiple
				? dropped.slice(0, 1)
				: listsOf(input).length > 0
					? merge(current, dropped)
					: dropped;
			change(input, next);
			const added = input.multiple ? dropped : dropped.slice(0, 1);
			announce(
				message(
					"added",
					{ count: added.length, file: added[0]?.name ?? "" },
					input,
				),
			);
		},
		{ signal },
	);

	const renderAll = () => {
		for (const input of managed()) render(input);
	};
	renderAll();

	return {
		refresh: renderAll,
		destroy: () => {
			for (const input of Array.from(rendered.keys())) clear(input);
			for (const zone of owned(`[${A.dropzone}]`)) {
				zone.removeAttribute(A.dragging);
				zone.removeAttribute(A.hasFiles);
			}
		},
	};
};

/**
 * Drop zones and file lists for file inputs. Pass it to `init`:
 * `forms.init({ extensions: [files] })`
 */
export const files: Extension = {
	name: "files",
	setup: createFiles,
};
