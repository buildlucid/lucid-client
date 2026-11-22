import { defineConfig } from "vite-plus";

// Astro reads astro.config.mjs; this file only defines the Vite+ tasks.
export default defineConfig({
	run: {
		tasks: {
			build: {
				command: ["astro check", "astro build"],
				dependsOn: [{ task: "build", from: "dependencies" }],
				cache: { input: [{ auto: true }, "!dist/**"] },
			},
		},
	},
});
