/** Reads `path` from `value`, or `undefined` when a step along it isn't an object. */
const evaluatePathValue = (value: unknown, path: readonly string[]) => {
	let current = value;
	for (const part of path) {
		if (typeof current !== "object" || current === null) return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
};

export default evaluatePathValue;
