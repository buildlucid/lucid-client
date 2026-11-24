import C from "../constants.js";
import type { Failure } from "./messages.js";

const A = C.attributes;

const UNITS: Record<string, number> = {
	b: 1,
	kb: 1024,
	mb: 1024 ** 2,
	gb: 1024 ** 3,
};

/** Reads a size such as `5MB`, `500 KB` or `2048` (bytes). Returns `null` when it can't be read. */
export const parseSize = (value: string | null): number | null => {
	const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)?$/i);
	if (!match) return null;
	const unit = UNITS[(match[2] ?? "b").toLowerCase()] ?? 1;
	return Number(match[1]) * unit;
};

/** Writes a size for people, such as `5 MB` or `1.5 KB` */
export const formatSize = (bytes: number) => {
	const units = ["bytes", "KB", "MB", "GB"];
	let size = bytes;
	let index = 0;
	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index++;
	}
	const rounded = index === 0 ? size : Math.round(size * 10) / 10;
	return `${rounded} ${units[index]}`;
};

/**
 * Whether a file matches an `accept` list of extensions, MIME types and
 * wildcards such as `.pdf, image/*`. Browsers only use `accept` to filter the
 * file picker, so dropped and pasted files are checked here.
 */
export const accepts = (file: File, accept: string) => {
	const tokens = accept
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);
	if (tokens.length === 0) return true;
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return tokens.some((token) => {
		if (token.startsWith(".")) return name.endsWith(token);
		if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
		return type === token;
	});
};

/**
 * Checks a file input's files against its `accept`, `data-form--max-size`,
 * `data-form--min-size` and `data-form--max-files`
 */
export const checkFiles = (input: HTMLInputElement): Failure | null => {
	const files = Array.from(input.files ?? []);
	if (files.length === 0) return null;

	const maxFiles = Number.parseInt(input.getAttribute(A.maxFiles) ?? "", 10);
	if (maxFiles > 0 && files.length > maxFiles)
		return { key: "maxFiles", tokens: { limit: maxFiles } };

	const accept = input.getAttribute("accept") ?? "";
	const max = parseSize(input.getAttribute(A.maxSize));
	const min = parseSize(input.getAttribute(A.minSize));
	for (const file of files) {
		if (!accepts(file, accept))
			return { key: "accept", tokens: { file: file.name, limit: accept } };
		if (max !== null && file.size > max)
			return {
				key: "maxSize",
				tokens: { file: file.name, limit: formatSize(max) },
			};
		if (min !== null && file.size < min)
			return {
				key: "minSize",
				tokens: { file: file.name, limit: formatSize(min) },
			};
	}
	return null;
};
