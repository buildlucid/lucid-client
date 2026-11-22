import lib from "./index.js";

/**
 * Accepts all cookie categories
 * - Fires the onConsentChange accept callback
 * - Closes the details and alert elements
 */
const acceptAll = () => lib.rejectAccept("accept");

export default acceptAll;
