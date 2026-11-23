import S from "../state.js";

/**
 * Destroys every carousel, removing their listeners and the attributes the library added
 */
const destroy = () => {
	for (const instance of Array.from(S.instances.values())) {
		instance.teardown();
		S.instances.delete(instance.api.element);
	}
	S.abortController.abort();
	S.initialised = false;
};

export default destroy;
