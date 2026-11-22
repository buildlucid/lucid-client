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
