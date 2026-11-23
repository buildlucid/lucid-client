const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

/**
 * Turns a short piece of copy into HTML: text is escaped and `backticks`
 * become inline code. Used for scenario descriptions, expectations and gaps.
 */
export const inline = (text: string) =>
	escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
