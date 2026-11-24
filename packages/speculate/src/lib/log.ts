import S from "../state.js";

/**
 * A util for logging
 * - Each message is only logged once until the next `init`
 */
const log = (type: "warn" | "info", msg: string) => {
	if (S.logged.has(msg)) return;
	S.logged.add(msg);
	if (type === "warn") console.warn(`[Speculate] ${msg}`);
	else console.info(`[Speculate] ${msg}`);
};

export default log;
