import accept from "./accept.js";
import alertState from "./alert-state.js";
import destroy from "./destroy.js";
import detailsState from "./details-state.js";
import dismiss from "./dismiss.js";
import formatCookieString from "./format-cookie-string.js";
import generateUUID from "./generate-uuid.js";
import getCookieConsent from "./get-cookie-consentt.js";
import getCookieState from "./get-cookie-state.js";
import getElements from "./get-elements.js";
import initialise from "./initialise.js";
import log from "./log.js";
import onConsentChange from "./on-consent-change.js";
import registerEvents from "./register-events.js";
import rejectAccept from "./reject-accept.js";
import reject from "./reject.js";
import save from "./save.js";
import setAttributes from "./set-attributes.js";
import setCookieState from "./set-cookie-state.js";
import toggleDetails from "./toggle-details.js";

const lib = {
	getElements,
	generateUUID,
	getCookieState,
	log,
	setCookieState,
	setAttributes,
	alertState,
	detailsState,
	onConsentChange,
	rejectAccept,
	accept,
	reject,
	dismiss,
	toggleDetails,
	save,
	registerEvents,
	initialise,
	destroy,
	getCookieConsent,
	formatCookieString,
};

export default lib;
