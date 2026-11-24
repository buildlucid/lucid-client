import type { FormResult } from "../types.js";

type Data = Record<string, unknown>;

const isRecord = (value: unknown): value is Data =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) =>
	typeof value === "string" && value !== "" ? value : undefined;

/** Messages from a string, a list of strings, or objects with a `message` */
const messagesOf = (value: unknown): string[] => {
	const items = Array.isArray(value) ? value : [value];
	return items.flatMap((item) => {
		const found =
			text(item) ?? (isRecord(item) ? text(item.message) : undefined);
		return found ? [found] : [];
	});
};

/**
 * Reads field errors from the shapes servers commonly send:
 * - By field: `{ errors: { email: ["Enter your email"], "files.0": "Too large" } }`
 * - A list: `{ errors: [{ name: "email", message: "Enter your email" }] }`, with `field` or `path` in place of `name`
 */
const errorsOf = (body: Data) => {
	const raw = body.errors;
	// A Map, so field names such as `constructor` aren't read from an object's prototype.
	const errors = new Map<string, string[]>();
	const add = (name: unknown, value: unknown) => {
		const key = Array.isArray(name) ? name.join(".") : text(name);
		const messages = messagesOf(value);
		if (key && messages.length > 0)
			errors.set(key, [...(errors.get(key) ?? []), ...messages]);
	};

	if (Array.isArray(raw)) {
		for (const item of raw)
			if (isRecord(item)) add(item.name ?? item.field ?? item.path, item);
	} else if (isRecord(raw)) {
		for (const [name, value] of Object.entries(raw)) add(name, value);
	}
	return errors.size > 0 ? Object.fromEntries(errors) : undefined;
};

/** Reads a JSON body, or `null` for an empty or unreadable one. A body that fails to download throws, as the send failed. */
const readBody = async (response: Response): Promise<unknown> => {
	const body = await response.text();
	if (body.trim() === "") return null;
	try {
		return JSON.parse(body);
	} catch {
		return null;
	}
};

/**
 * The default response parser. It reads `message`, `redirect` and `errors`
 * from a JSON body, and treats a response with no body, such as a 204, by its
 * status alone. A response with field errors, or `success: false`, is
 * refused even with a 2xx status.
 */
const parse = async (response: Response): Promise<FormResult> => {
	const body = await readBody(response);
	const data = isRecord(body) ? body : {};
	const errors = errorsOf(data);
	const result: FormResult = {
		ok: response.ok && data.success !== false && errors === undefined,
		data: body,
	};

	const message = text(data.message);
	const redirect = text(data.redirect);
	if (message) result.message = message;
	if (redirect) result.redirect = redirect;
	if (errors) result.errors = errors;
	return result;
};

export default parse;
