const PLACEHOLDER = /\{(n|count)\}/g;

/** Replaces `{n}` and `{count}` in a label */
const format = (text: string, n: number, count: number) =>
	text.replace(PLACEHOLDER, (_, key: string) =>
		String(key === "n" ? n : count),
	);

export default format;
