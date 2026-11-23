import { localAdapter, sessionAdapter } from "../core/persist/adapters.js";

const DEFAULT_OPTIONS = {
	debug: false,
	attributes: {
		prefix: "data-",
		store: "store",
		state: "state--",
		persist: "persist",
		scopeSeparator: ":",
		specifierSeparator: "--",
	},
	persistence: {
		prefix: "catalyst:",
		storage: "local",
		sync: false,
		adapters: {
			local: localAdapter,
			session: sessionAdapter,
		},
	},
} as const;

export default DEFAULT_OPTIONS;
