import tsdownConfig from "@repo/config/tsdownconfig-base.json" with {
	type: "json",
};
import { defineConfig, type UserConfig } from "tsdown";

export default defineConfig({
	...(tsdownConfig as UserConfig),
	entry: [
		"src/index.ts",
		"src/handlers.ts",
		"src/helpers.ts",
		"src/types/index.ts",
	],
});
