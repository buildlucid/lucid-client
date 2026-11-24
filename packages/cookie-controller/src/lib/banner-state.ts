import C from "../constants.js";
import S from "../state.js";

/**
 * Shows or hides the banner
 */
const setBannerState = (open: boolean) => {
	S.elements?.banner?.setAttribute(
		C.attributes.banner,
		open ? "true" : "false",
	);
	S.elements?.banner?.toggleAttribute("hidden", !open);
};

/**
 * Returns whether the banner is showing
 */
const getBannerState = () =>
	S.elements?.banner?.getAttribute(C.attributes.banner) === "true";

export default {
	get: getBannerState,
	set: setBannerState,
};
