import packBase from "@repo/config/pack-base";
import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: packBase,
	run: {
		tasks: {
			build: {
				command: ["tsc --noEmit", "vp pack"],
			},
		},
	},
});
