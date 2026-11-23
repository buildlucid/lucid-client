const DEFAULT_OPTIONS = {
	debug: false,
	attributes: {
		prefix: "data-",
		store: "store",
		state: "state--",
		persist: "persist",
		ignore: "ignore",
		scopeSeparator: ":",
		specifierSeparator: "--",
	},
} as const;

export default DEFAULT_OPTIONS;
