/**
 * A util for logging
 */
const log = (type: "warn", msg: string) => {
	if (type === "warn") console.warn(`[Carousel] ${msg}`);
};

export default log;
