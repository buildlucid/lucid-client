export type Recorder = {
	/** Sets or removes an attribute, remembering its original value the first time */
	attr: (element: Element, name: string, value: string | null) => void;
	/** Sets an attribute the markup doesn't set itself, so the author's own value always wins */
	fallback: (element: Element, name: string, value: string) => void;
	/** Replaces an element's content, remembering the original content the first time */
	content: (element: Element, ...nodes: Array<Node | string>) => void;
	/** Puts back every original value and content */
	restore: () => void;
	/** Stops every later write, once the form is destroyed */
	close: () => void;
};

type Entry = {
	/** The value before the recorder first changed it */
	value: string | null;
	/** The value the recorder last wrote. A different current value means something else has changed it since. */
	written: string | null;
};

/**
 * Tracks every attribute and piece of content the library changes, so
 * destroying a form leaves the markup as it was rendered. Attributes changed
 * by something else since the library wrote them are left as they are.
 * Attributes are read and written through the prototype, as the form is one
 * of the elements and a field can be named like those methods.
 */
const createRecorder = (): Recorder => {
	const attributes = new Map<Element, Map<string, Entry>>();
	const contents = new Map<Element, Node[]>();
	let closed = false;

	const attr: Recorder["attr"] = (element, name, value) => {
		if (closed) return;
		const current = Element.prototype.getAttribute.call(element, name);
		let entries = attributes.get(element);
		const existing = entries?.get(name);
		if (existing) existing.written = value;
		if (current === value) return;
		if (!existing) {
			if (!entries) {
				entries = new Map();
				attributes.set(element, entries);
			}
			entries.set(name, { value: current, written: value });
		}
		if (value === null) Element.prototype.removeAttribute.call(element, name);
		else Element.prototype.setAttribute.call(element, name, value);
	};

	/** Whether the recorder added an attribute the markup didn't have, and it still has the recorder's value */
	const added = (element: Element, name: string) => {
		const entry = attributes.get(element)?.get(name);
		return (
			entry !== undefined &&
			entry.value === null &&
			entry.written !== null &&
			Element.prototype.getAttribute.call(element, name) === entry.written
		);
	};

	return {
		attr,
		fallback: (element, name, value) => {
			if (
				Element.prototype.hasAttribute.call(element, name) &&
				!added(element, name)
			)
				return;
			attr(element, name, value);
		},
		content: (element, ...nodes) => {
			if (closed) return;
			if (!contents.has(element))
				contents.set(element, Array.from(element.childNodes));
			element.replaceChildren(...nodes);
		},
		restore: () => {
			for (const [element, nodes] of contents)
				element.replaceChildren(...nodes);
			for (const [element, entries] of attributes) {
				for (const [name, entry] of entries) {
					if (
						Element.prototype.getAttribute.call(element, name) !== entry.written
					)
						continue;
					if (entry.value === null)
						Element.prototype.removeAttribute.call(element, name);
					else Element.prototype.setAttribute.call(element, name, entry.value);
				}
			}
			contents.clear();
			attributes.clear();
		},
		close: () => {
			closed = true;
		},
	};
};

export default createRecorder;
