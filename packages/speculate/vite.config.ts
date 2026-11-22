import packBase, { buildTask } from "@repo/config/pack-base";
import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: packBase,
	run: {
		tasks: {
			build: buildTask,
		},
	},
});
