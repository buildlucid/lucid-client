import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	// Keeps the whitespace of scenario markup, which the "Markup" panels show.
	compressHTML: false,
	// The toolbar is appended to <body>, so focus traps would make it inert and
	// it would sit over the activity log.
	devToolbar: { enabled: false },
	redirects: {
		"/catalyst": "/catalyst/stores",
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
