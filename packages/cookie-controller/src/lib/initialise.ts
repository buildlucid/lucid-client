import C from "../constants.js";
import S from "../state.js";
import type { Options } from "../types.js";
import lib from "./index.js";

/**
 * Initialises the library
 * - The details element is required. The alert element is optional, so a site can show its own banner from onConsentChange
 */
const initialise = (initOptions?: Partial<Options>) => {
	lib.destroy();
	S.options = {
		cookies: initOptions?.cookies ?? {},
		onConsentChange: initOptions?.onConsentChange ?? null,
		policyVersion: initOptions?.policyVersion ?? null,
		onPolicyVersionChange: initOptions?.onPolicyVersionChange ?? null,
		storage: {
			path: "/",
			sameSite: "Strict",
			secure: window.location.protocol === "https:",
			...initOptions?.storage,
			expires: initOptions?.storage?.expires ?? C.defaultExpires,
		},
	};

	S.elements = lib.getElements();
	S.abortController = new AbortController();
	S.alertClosed = false;

	if (!S.elements.details) {
		lib.log("warn", "No details element has been found.");
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

	if (previousVersion !== undefined && S.options.policyVersion !== null) {
		S.options.onPolicyVersionChange?.(
			previousVersion,
			S.options.policyVersion,
		);
	}
	lib.onConsentChange("load");
};

export default initialise;
