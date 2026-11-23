import type { StoreRefs } from "../../types/index.js";

const createRefs = (elements: Map<string, Element | Element[]>): StoreRefs => ({
	get: <E extends Element = HTMLElement>(name: string) => {
		const value = elements.get(name);
		return (Array.isArray(value) ? value[0] : value) as E | undefined;
	},
	all: <E extends Element = HTMLElement>(name: string) => {
		const value = elements.get(name);
		if (value === undefined) return [];
		return (Array.isArray(value) ? [...value] : [value]) as E[];
	},
});

export default createRefs;
