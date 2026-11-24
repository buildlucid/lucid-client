import lib from "./index.js";

/**
 * Logs why a link isn't speculated, in the development build
 */
const skip = (link: HTMLAnchorElement, reason: string): null => {
	if (__DEV__) {
		lib.log(
			"warn",
			`The link to ${link.getAttribute("href")} ${reason}, so it isn't speculated.`,
		);
	}
	return null;
};

/**
 * Returns where a link opens: its own `target`, or else the page's default from `<base target>`
 */
const linkTarget = (link: HTMLAnchorElement) =>
	link.getAttribute("target") ??
	document.querySelector("base[target]")?.getAttribute("target") ??
	"";

/**
 * Returns the URL to speculate for a link, or null when it can't be speculated
 * - Only http and https links to the same origin that open in the same tab can be used, so links to other sites, new tabs and downloads are left out
 * - Links to the current page are left out, ignoring the hash, though the same path with a different query is kept
 */
const linkUrl = (link: HTMLAnchorElement): URL | null => {
	if (!link.hasAttribute("href")) return skip(link, "has no href");
	const target = linkTarget(link).toLowerCase();
	if (target !== "" && target !== "_self") {
		return skip(link, "opens in another tab or window");
	}
	if (link.hasAttribute("download")) return skip(link, "downloads a file");

	let url: URL;
	try {
		url = new URL(link.href);
	} catch {
		return skip(link, "isn't a valid URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return skip(link, "isn't an http or https link");
	}
	if (url.origin !== window.location.origin) {
		return skip(link, "goes to another origin");
	}
	if (lib.withoutHash(url) === lib.withoutHash(window.location.href)) {
		return null;
	}

	return url;
};

export default linkUrl;
