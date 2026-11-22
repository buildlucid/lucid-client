import acceptAll from "./accept-all.js";
import alertState from "./alert-state.js";
import closeAlert from "./close-alert.js";
import closeDetails from "./close-details.js";
import destroy from "./destroy.js";
import detailsState from "./details-state.js";
import formatCookieString from "./format-cookie-string.js";
import generateUUID from "./generate-uuid.js";
import getConsent from "./get-consent.js";
import getCookieState from "./get-cookie-state.js";
import getElements from "./get-elements.js";
import initialise from "./initialise.js";
import log from "./log.js";
import onConsentChange from "./on-consent-change.js";
import openDetails from "./open-details.js";
import refresh from "./refresh.js";
import registerEvents from "./register-events.js";
import rejectAccept from "./reject-accept.js";
import rejectAll from "./reject-all.js";
import saveDetails from "./save-details.js";
import setAttributes from "./set-attributes.js";
import setCookieState from "./set-cookie-state.js";
import toggleDetails from "./toggle-details.js";
import updateConsent from "./update-consent.js";

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
	acceptAll,
	rejectAll,
	saveDetails,
	openDetails,
	closeDetails,
	toggleDetails,
	closeAlert,
	registerEvents,
	initialise,
	refresh,
	destroy,
	getConsent,
	updateConsent,
	formatCookieString,
};

export default lib;
