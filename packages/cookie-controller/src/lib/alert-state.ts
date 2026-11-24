import C from "../constants.js";
import S from "../state.js";

/**
 * Sets the alert modal state - open/close
 */
const setAlertState = (modalState: boolean) => {
	S.elements?.alert?.setAttribute(
		C.attributes.alert,
		modalState ? "true" : "false",
	);
	S.elements?.alert?.toggleAttribute("hidden", !modalState);
};

/**
 * Returns the alert modal state - open/close
 */
const getAlertState = () =>
	S.elements?.alert?.getAttribute(C.attributes.alert) === "true";

export default {
	get: getAlertState,
	set: setAlertState,
};
