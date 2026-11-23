import type { Library } from "../suite.ts";

/** Catalyst comes first: its output is the reference the others are checked against. */
export const libraries: Library[] = [
	{
		id: "catalyst",
		name: "Catalyst",
		package: "@lucidclient/catalyst",
		homepage: "https://github.com/ProtoDigitalUK/lucid_client",
	},
	{
		id: "alpine",
		name: "Alpine.js",
		package: "alpinejs",
		homepage: "https://alpinejs.dev/",
	},
	{
		id: "petite-vue",
		name: "petite-vue",
		package: "petite-vue",
		homepage: "https://github.com/vuejs/petite-vue",
	},
	{
		id: "vanilla",
		name: "Vanilla JS",
		package: null,
		homepage: null,
	},
];
