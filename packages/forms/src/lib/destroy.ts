import S, { defaultSettings } from "../state.js";

/**
 * Destroys every form, removing their listeners and everything the library added to the markup
 */
const destroy = () => {
	for (const instance of Array.from(S.instances.values())) {
		instance.teardown();
		S.instances.delete(instance.api.element);
	}
	S.abortController.abort();
	S.settings = defaultSettings();
	S.initialised = false;
};

export default destroy;
