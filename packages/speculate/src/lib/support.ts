import type { Support } from "../types.js";

/**
 * Checks what the browser supports
 * - Read when `init` runs rather than on import, so the library can be imported where there is no DOM
 */
const support = (): Support => ({
	rules: HTMLScriptElement.supports?.("speculationrules") ?? false,
	linkPrefetch:
		document.createElement("link").relList?.supports?.("prefetch") ?? false,
});

export default support;
