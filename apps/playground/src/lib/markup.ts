import { format } from "prettier";

/**
 * Formats a scenario's rendered markup for its "Markup" panel. Class
 * attributes are removed so only the attributes being tested remain, and
 * playground helpers, which use `pg-*` elements, are left out.
 */
export const formatMarkup = async (html: string) => {
	const stripped = html
		.replace(/<(pg-[\w-]+)\b[\s\S]*?<\/\1>/g, "")
		.replace(/\s+class="[^"]*"/g, "")
		.replace(/\s+data-astro-[\w-]+(="[^"]*")?/g, "");
	try {
		const formatted = await format(stripped, {
			parser: "html",
			printWidth: 76,
			tabWidth: 2,
			useTabs: false,
			htmlWhitespaceSensitivity: "ignore",
		});
		return formatted.trim();
	} catch {
		return stripped.trim();
	}
};
