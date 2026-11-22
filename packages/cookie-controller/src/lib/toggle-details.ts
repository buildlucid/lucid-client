import lib from "./index.js";

/** Opens the details element, or closes it without saving. */
const toggleDetails = () => {
	if (lib.detailsState.get()) lib.closeDetails();
	else lib.openDetails();
};

export default toggleDetails;
