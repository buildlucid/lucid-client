import lib from "./lib/index.js";

export type {
	ConsentChange,
	GetConsentOptions,
	Options,
	StorageOptions,
} from "./types.js";

export default {
	init: lib.initialise,
	refresh: lib.refresh,
	destroy: lib.destroy,
	getConsent: lib.getConsent,
	updateConsent: lib.updateConsent,
	acceptAll: lib.acceptAll,
	rejectAll: lib.rejectAll,
	saveDetails: lib.saveDetails,
	openDetails: lib.openDetails,
	closeDetails: lib.closeDetails,
};
