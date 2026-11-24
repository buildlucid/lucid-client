import lib from "./lib/index.js";

export type {
	Control,
	Extension,
	ExtensionContext,
	ExtensionInstance,
	Form,
	FormInvalidDetail,
	FormResult,
	FormResultDetail,
	FormState,
	FormStatus,
	FormSubmitDetail,
	Message,
	Messages,
	MessageTokens,
	Options,
	Rule,
	RuleContext,
} from "./types.js";

export default {
	init: lib.initialise,
	refresh: lib.refresh,
	destroy: lib.destroy,
	get: lib.get,
};
