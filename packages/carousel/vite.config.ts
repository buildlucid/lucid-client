import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: ["src/index.ts", "src/catalyst.ts"],
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
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					environment: "happy-dom",
					include: ["tests/*.test.ts"],
					setupFiles: ["./tests/setup.ts"],
				},
			},
			// Runs the carousel in Chromium, Firefox and WebKit with Playwright, as happy-dom doesn't scroll or snap.
			{
				extends: true,
				test: {
					name: "browser",
					environment: "node",
					include: ["tests/browser/**/*.test.ts"],
					testTimeout: 30_000,
					hookTimeout: 60_000,
					// Each test has its own browser context, so they can run side by side.
					sequence: { concurrent: true },
					maxConcurrency: 6,
				},
			},
		],
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
