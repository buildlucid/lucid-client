import C from "../constants.js";
import lib from "./index.js";

const SOURCE_ATTRIBUTES = [
	["data-src", "src"],
	["data-srcset", "srcset"],
] as const;

/**
 * Consent gated elements: anything with a category that is not a category checkbox or an action element, and has not been activated yet
 */
const selector = `[${C.attributes.cookieCategory}]:not([${C.attributes.activated}]):not(input[type="checkbox"]):not([${C.attributes.action.attribute}])`;

/** Every category in the space separated attribute value must be consented. */
const isConsented = (element: Element) => {
	const categories = (
		element.getAttribute(C.attributes.cookieCategory) ?? ""
	).split(/\s+/);
	return categories.every(
		(category) => category === "" || lib.getConsent(category) === true,
	);
};

/** Moves data-src/data-srcset onto src/srcset. */
const swapSources = (element: Element) => {
	for (const [from, to] of SOURCE_ATTRIBUTES) {
		const value = element.getAttribute(from);
		if (value === null) continue;
		element.setAttribute(to, value);
		element.removeAttribute(from);
	}
};

/**
 * Loads an iframe, image, video, audio or picture element
 * - The child source elements of a video, audio or picture, and the img inside a picture, are swapped too
 */
const activateMedia = (element: Element) => {
	swapSources(element);
	if (
		element instanceof HTMLMediaElement ||
		element instanceof HTMLPictureElement
	) {
		for (const child of element.querySelectorAll(
			":scope > source, :scope > img",
		))
			swapSources(child);
	}
	if (element instanceof HTMLMediaElement) element.load();
};

/**
 * Builds a runnable copy of a script, as changing the type of an existing script does not run it
 * - The type comes from data-type, or defaults to classic JavaScript
 * - The nonce is copied from the property, as browsers hide the attribute value
 */
const createScript = (script: HTMLScriptElement) => {
	const replacement = document.createElement("script");
	for (const { name, value } of script.attributes) {
		if (name === "type" || name === C.attributes.scriptType) continue;
		replacement.setAttribute(name, value);
	}
	const type = script.getAttribute(C.attributes.scriptType);
	if (type) replacement.type = type;
	if (script.nonce) replacement.nonce = script.nonce;
	// Inserted scripts are async by default, so keep the page order unless the script asked for async.
	if (!script.hasAttribute("async")) replacement.async = false;
	replacement.text = script.text;
	return replacement;
};

/**
 * Runs scripts in page order
 * - Waits for each external, non async, classic script to load before the next, as the HTML parser would
 */
const activateScripts = async (scripts: HTMLScriptElement[]) => {
	for (const script of scripts) {
		if (!script.isConnected) continue;
		const replacement = createScript(script);
		const blocking =
			replacement.src !== "" &&
			!replacement.async &&
			replacement.type !== "module";
		const loaded = blocking
			? new Promise<void>((resolve) => {
					replacement.addEventListener("load", () => resolve(), { once: true });
					replacement.addEventListener("error", () => resolve(), {
						once: true,
					});
				})
			: null;
		script.replaceWith(replacement);
		if (loaded) await loaded;
	}
};

/**
 * Activates the consent gated scripts and media whose categories are consented
 * - Each element is activated once, and is marked with data-cookie-activated
 * - Withdrawing consent does not undo anything that has already loaded
 */
const activateElements = () => {
	const scripts: HTMLScriptElement[] = [];
	for (const element of document.querySelectorAll(selector)) {
		if (!isConsented(element)) continue;
		// Marked straight away so a second call cannot pick up a script that is still queued.
		element.setAttribute(C.attributes.activated, "");
		if (element instanceof HTMLScriptElement) scripts.push(element);
		else activateMedia(element);
	}
	if (scripts.length > 0) void activateScripts(scripts);
};

export default activateElements;
