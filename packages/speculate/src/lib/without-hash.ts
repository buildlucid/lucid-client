/**
 * Returns a URL without its hash
 */
const withoutHash = (url: URL | string) => {
	const copy = new URL(url);
	copy.hash = "";
	return copy.href;
};

export default withoutHash;
