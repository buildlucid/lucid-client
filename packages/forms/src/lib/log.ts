/**
 * A util for logging
 */
const log = (type: "warn" | "error", msg: string, data?: unknown) => {
	const args = data === undefined ? [] : [data];
	if (type === "warn") console.warn(`[Forms] ${msg}`, ...args);
	else console.error(`[Forms] ${msg}`, ...args);
};

export default log;
