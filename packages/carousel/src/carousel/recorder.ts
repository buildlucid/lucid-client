export type Recorder = {
	/** Sets or removes an attribute, remembering its original value the first time */
	attr: (element: Element, name: string, value: string | null) => void;
	/** Sets an attribute the markup doesn't set itself, so the author's own value always wins */
	fallback: (element: Element, name: string, value: string) => void;
	/** Whether the recorder added an attribute the markup didn't have, and it still has the recorder's value */
	added: (element: Element, name: string) => boolean;
	/** Sets or removes an inline style property, remembering its original value the first time */
	style: (element: HTMLElement, property: string, value: string | null) => void;
	/** Puts back every original value, or only those of one element */
	restore: (element?: Element) => void;
	/** Drops what was recorded for an element the library removed, without putting anything back */
	forget: (element: Element) => void;
	/** Puts back one inline style property's original value */
	reset: (element: HTMLElement, property: string) => void;
	/** Stops every later write, once the carousel is destroyed */
	close: () => void;
};

type Entry = {
	/** The value before the recorder first changed it */
	value: string | null;
	priority?: string;
	/** The value the recorder last wrote. A different current value means something else has changed it since. */
	written: string | null;
};

/** What the recorder changed on one element */
type Changes = {
	attributes: Map<string, Entry>;
	styles: Map<string, Entry>;
	/** The `style` attribute before the first style property was written, so an empty one can be removed again */
	styleAttribute?: string | null;
};

/**
 * Tracks every attribute and inline style the library changes, so destroying a
 * carousel leaves the markup as it was rendered. Values changed by something
 * else since the library wrote them, such as the author or another carousel,
 * are left as they are.
 */
const createRecorder = (): Recorder => {
	const saved = new Map<Element, Changes>();
	let closed = false;

	const changesFor = (element: Element) => {
		let changes = saved.get(element);
		if (!changes) {
			changes = { attributes: new Map(), styles: new Map() };
			saved.set(element, changes);
		}
		return changes;
	};

	const attr: Recorder["attr"] = (element, name, value) => {
		if (closed) return;
		const current = element.getAttribute(name);
		const existing = saved.get(element)?.attributes.get(name);
		if (existing) existing.written = value;
		if (current === value) return;
		if (!existing)
			changesFor(element).attributes.set(name, {
				value: current,
				written: value,
			});
		if (value === null) element.removeAttribute(name);
		else element.setAttribute(name, value);
	};

	const added = (element: Element, name: string) => {
		const entry = saved.get(element)?.attributes.get(name);
		return (
			entry !== undefined &&
			entry.value === null &&
			entry.written !== null &&
			element.getAttribute(name) === entry.written
		);
	};

	/** Whether a style property still has the value the recorder wrote, which it never marks important */
	const ownsStyle = (
		style: CSSStyleDeclaration,
		property: string,
		entry: Entry,
	) =>
		(style.getPropertyValue(property) || null) === entry.written &&
		style.getPropertyPriority(property) === "";

	const resetStyle = (
		style: CSSStyleDeclaration,
		property: string,
		entry: Entry,
	) => {
		if (!ownsStyle(style, property, entry)) return;
		if (entry.value === null) style.removeProperty(property);
		else style.setProperty(property, entry.value, entry.priority);
	};

	/** Removes a `style` attribute the markup didn't have, once the styles written to it are gone */
	const tidyStyle = (element: Element, changes: Changes) => {
		if (changes.styleAttribute === null && element.getAttribute("style") === "")
			element.removeAttribute("style");
	};

	const restoreElement = (element: Element, changes: Changes) => {
		const style = (element as HTMLElement).style;
		// Styles go first, so a style attribute the markup didn't have can be removed once it is empty.
		for (const [property, original] of changes.styles)
			resetStyle(style, property, original);
		for (const [name, original] of changes.attributes) {
			if (element.getAttribute(name) !== original.written) continue;
			if (original.value === null) element.removeAttribute(name);
			else element.setAttribute(name, original.value);
		}
		tidyStyle(element, changes);
		saved.delete(element);
	};

	return {
		attr,
		added,
		fallback: (element, name, value) => {
			// Only fill in attributes the author left out, or ones this recorder added.
			if (element.hasAttribute(name) && !added(element, name)) return;
			attr(element, name, value);
		},
		style: (element, property, value) => {
			if (closed) return;
			const current = element.style.getPropertyValue(property) || null;
			const existing = saved.get(element)?.styles.get(property);
			if (existing) existing.written = value;
			if (current === value) return;
			const changes = changesFor(element);
			if (changes.styleAttribute === undefined)
				changes.styleAttribute = element.getAttribute("style");
			if (!existing)
				changes.styles.set(property, {
					value: current,
					priority: element.style.getPropertyPriority(property),
					written: value,
				});
			if (value === null) element.style.removeProperty(property);
			else element.style.setProperty(property, value);
		},
		restore: (element) => {
			if (element) {
				const changes = saved.get(element);
				if (changes) restoreElement(element, changes);
				return;
			}
			for (const [target, changes] of saved) restoreElement(target, changes);
		},
		forget: (element) => {
			saved.delete(element);
		},
		reset: (element, property) => {
			if (closed) return;
			const changes = saved.get(element);
			const original = changes?.styles.get(property);
			if (!changes || !original) return;
			resetStyle(element.style, property, original);
			changes.styles.delete(property);
			tidyStyle(element, changes);
		},
		close: () => {
			closed = true;
		},
	};
};

export default createRecorder;
