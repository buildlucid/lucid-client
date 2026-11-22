import packBase from "@repo/config/pack-base";
import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		...packBase,
		entry: [
			"src/index.ts",
			"src/handlers.ts",
			"src/helpers.ts",
			"src/types/index.ts",
		],
	},
	run: {
		tasks: {
			build: {
				command: ["tsc --noEmit", "vp pack"],
			},
		},
	},
});
