import C from "./constants.js";
import type { Extension, Form, Messages, Options, Rule } from "./types.js";

/** A form as the library keeps it, with the parts the public API doesn't expose */
export type Instance = {
	api: Form;
	/** Handles an event routed to this form from the document */
	handle: (event: Event) => void;
	/** Destroys the form without telling the registry, for destroying every form at once */
	teardown: () => void;
};

type Settings = {
	messages: Messages;
	rules: Record<string, Rule>;
	extensions: Extension[];
	send: Options["send"];
	parse: Options["parse"];
};

export const defaultSettings = (): Settings => ({
	messages: { ...C.messages },
	rules: {},
	extensions: [],
	send: undefined,
	parse: undefined,
});

const S: {
	settings: Settings;
	instances: Map<HTMLFormElement, Instance>;
	abortController: AbortController;
	initialised: boolean;
	/** Counts the ids generated for elements without one */
	ids: number;
} = {
	settings: defaultSettings(),
	instances: new Map(),
	abortController: new AbortController(),
	initialised: false,
	ids: 0,
};

export default S;
