import C from "../constants.js";
import S from "../state.js";
import type { Options } from "../types.js";
import lib from "./index.js";

/**
 * Initialises the library, enhancing every `data-form` element on the page
 * - Calling it again destroys every form and enhances the page again with the new options
 * - Before the document has loaded, it waits for `DOMContentLoaded`
 */
const initialise = (options?: Options) => {
	if (S.initialised) lib.destroy();

	S.settings = {
		messages: { ...C.messages, ...options?.messages },
		rules: { ...options?.rules },
		extensions: [...(options?.extensions ?? [])],
		send: options?.send,
		parse: options?.parse,
	};
	S.abortController = new AbortController();
	S.initialised = true;
	lib.registerEvents();

	if (document.readyState === "loading") {
		document.addEventListener(
			"DOMContentLoaded",
			() => {
				if (S.initialised) lib.scan();
			},
			{ once: true, signal: S.abortController.signal },
		);
		return;
	}
	lib.scan();
};

export default initialise;
