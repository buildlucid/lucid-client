const stringifyState = (value: unknown): string => {
	if (typeof value === "string") return value;
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "object") {
		try {
			return JSON.stringify(value);
		} catch {
			return Object.prototype.toString.call(value);
		}
	}
	return String(value as string | number | boolean | bigint | symbol);
};

export default stringifyState;
