import type { UserConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

/** Shared `vp pack` options for the published libraries. */
const packBase = {
	entry: ["src/index.ts"],
	platform: "browser",
	target: "es2022",
	format: ["esm", "cjs"],
	fixedExtension: false,
	cjsDefault: false,
	dts: true,
	sourcemap: true,
	minify: true,
	deps: {
		neverBundle: true,
	},
} satisfies PackUserConfig;

export default packBase;

type Task = NonNullable<NonNullable<UserConfig["run"]>["tasks"]>[string];

/**
 * Shared `build` task for the published libraries.
 * - TypeScript 7's native `tsc` reads files outside of Vite+'s automatic input tracking, so the sources it checks are listed explicitly
 */
export const buildTask = {
	command: ["tsc --noEmit", "vp pack"],
	cache: {
		input: [
			{ auto: true },
			"src/**",
			"tsconfig.json",
			{ pattern: "packages/config/*", base: "workspace" },
		],
	},
} satisfies Task;
