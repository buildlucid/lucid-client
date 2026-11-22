/**
 * Numbers are only inferred when converting them back produces the original
 * text, so values such as `"007"`, `"1e3"` or long numeric ids stay strings
 * instead of being rewritten.
 */
const isLosslessNumber = (value: string) => {
	const number = Number(value);
	return Number.isFinite(number) && String(number) === value;
};

const parseStateString = (value: string | null): unknown => {
	if (value === null) return null;
	if (value === "") return "";
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	if (value === "undefined") return undefined;
	if (isLosslessNumber(value)) return Number(value);

	if (/^\s*[{[]/.test(value)) {
		try {
			return JSON.parse(value) as unknown;
		} catch {
			return value;
		}
	}

	return value;
};

export default parseStateString;
