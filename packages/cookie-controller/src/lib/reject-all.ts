import lib from "./index.js";

/**
 * Rejects all cookie categories
 * - Fires the onConsentChange reject callback
 * - Closes the details and alert elements
 */
const rejectAll = () => lib.rejectAccept("reject");

export default rejectAll;
