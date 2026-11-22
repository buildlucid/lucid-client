import S from "../state.js";

/**
 * Destroys the cookie controller instance and removes all event listeners
 */
const destroy = () => {
	S.abortController.abort();
	S.initialised = false;
};

export default destroy;
