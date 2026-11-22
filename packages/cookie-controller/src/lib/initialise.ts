import S from "../state.js";
import type { Options } from "../types.js";
import lib from "./index.js";

/**
 * Initialises the library
 */
const initialise = (initOptions?: Partial<Options>) => {
	lib.destroy();
	S.options = {
		categoryCookies: initOptions?.categoryCookies ?? {},
		onConsentChange: initOptions?.onConsentChange ?? null,
		version: initOptions?.version ?? null,
		storage: {
			path: "/",
			sameSite: "Strict",
			secure: window.location.protocol === "https:",
			...initOptions?.storage,
		},
	};

	S.elements = lib.getElements();
	S.abortController = new AbortController();
	S.alertClosed = false;

	if (!S.elements.details) {
		lib.log("warn", "No details element has been found.");
		return;
	}
	if (!S.elements.alert) {
		lib.log("warn", "No alert element has been found.");
		return;
	}

	const { state, previousVersion } = lib.getCookieState();
	S.state = state;
	lib.setAttributes("static");
	lib.setAttributes("dynamic");

	lib.detailsState.set(false);
	lib.alertState.set(!S.state.decided);
	lib.registerEvents();

	S.initialised = true;

	if (previousVersion !== undefined && S.options.version) {
		S.options.version.onNewVersion?.(
			previousVersion,
			S.options.version.current,
		);
	}
	lib.onConsentChange("onload");
};

export default initialise;
