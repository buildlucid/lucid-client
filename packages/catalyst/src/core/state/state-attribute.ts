import { parseStateString } from "../../helpers.js";
import Catalyst from "../../runtime/catalyst.js";

let statePrefix = { attributes: Catalyst.options.attributes, value: "" };

/** `data-state--`, kept until the attribute options change. */
export const getStatePrefix = () => {
	const { attributes } = Catalyst.options;
	if (statePrefix.attributes !== attributes || !statePrefix.value) {
		statePrefix = {
			attributes,
			value: `${attributes.prefix}${attributes.state}`,
		};
	}
	return statePrefix.value;
};

/** `data-state--user-name` → `userName`, matching `dataset`. */
export const attributeToStateKey = (attributeName: string) => {
	const prefix = getStatePrefix();
	if (!attributeName.startsWith(prefix)) return null;
	const name = attributeName.slice(prefix.length);
	if (!name) return null;
	if (!name.includes("-")) return name;
	return name.replace(/-([a-z])/g, (_, character: string) =>
		character.toUpperCase(),
	);
};

/** `userName` → `data-state--user-name`. */
export const stateKeyToAttribute = (key: string) =>
	`${getStatePrefix()}${key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;

/**
 * Parses an attribute value written by something other than Catalyst. Once a
 * state value has a type it keeps it, so a string signal is not turned into a
 * number because its attribute happens to look numeric.
 */
export const coerceStateString = (value: string | null, current: unknown) => {
	if (value === null) return null;
	if (typeof current === "string") return value;
	if (typeof current === "number") {
		const number = Number(value);
		if (value.trim() !== "" && !Number.isNaN(number)) return number;
	}
	if (typeof current === "boolean") {
		if (value === "true") return true;
		if (value === "false") return false;
	}
	return parseStateString(value);
};
