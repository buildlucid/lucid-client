/**
 * Returns why speculating would cost the visitor, or null when it wouldn't
 * - Offline visitors, Save-Data and 2G or 3G connections are left alone
 */
const connectionProblem = (): string | null => {
	if (!navigator.onLine) return "the device is offline";

	const connection = navigator.connection;
	if (connection?.saveData) return "Save-Data is on";
	if (connection?.effectiveType && /2g|3g/.test(connection.effectiveType)) {
		return `the connection is ${connection.effectiveType}`;
	}
	return null;
};

export default connectionProblem;
