import C from "../constants.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads the saved preference cookie
 * - Returns null when there is no cookie, or it cannot be parsed
 */
const readCookie = (): Record<string, unknown> | null => {
	try {
		const prefix = `${C.key}=`;
		const cookie = document.cookie
			.split(";")
			.map((part) => part.trim())
			.find((part) => part.startsWith(prefix));
		if (!cookie) return null;
		const value = cookie.slice(prefix.length);
		const stored: unknown = JSON.parse(
			value.startsWith("{") ? value : decodeURIComponent(value),
		);
		return isRecord(stored) ? stored : null;
	} catch {
		return null;
	}
};

export default readCookie;
