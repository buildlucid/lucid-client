import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: [
			"src/index.ts",
			"src/reactions.ts",
			"src/helpers.ts",
			"src/types/index.ts",
		],
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
	},
	resolve: {
		conditions: ["browser"],
	},
	test: {
		environment: "happy-dom",
		include: ["tests/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
	},
	run: {
		tasks: {
			build: {
				command: ["tsc --noEmit", "vp pack"],
				cache: {
					// TypeScript 7's native tsc reads files outside of Vite+'s automatic input tracking, so its inputs are listed explicitly.
					input: [{ auto: true }, "src/**", "tsconfig.json"],
				},
			},
		},
	},
});
