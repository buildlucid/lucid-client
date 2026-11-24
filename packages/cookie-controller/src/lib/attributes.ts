import S from "../state.js";

/** Sets an attribute the markup doesn't set itself, remembering it so `restoreAttributes` can remove it */
export const addAttribute = (element: Element, name: string, value: string) => {
	if (element.hasAttribute(name)) return;
	element.setAttribute(name, value);
	S.added.push([element, name, value]);
};

/** Removes the attributes the library added, apart from any changed since */
export const restoreAttributes = () => {
	for (const [element, name, value] of S.added)
		if (element.getAttribute(name) === value) element.removeAttribute(name);
	S.added = [];
};
