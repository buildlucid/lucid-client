import { defineConfig } from "vite-plus";

const entry = [
	"src/index.ts",
	"src/files.ts",
	"src/turnstile.ts",
	"src/recaptcha.ts",
];

const shared = {
	entry,
	platform: "browser",
	target: "es2022",
	fixedExtension: false,
	sourcemap: true,
	deps: {
		neverBundle: true,
	},
} as const;

export default defineConfig({
	pack: [
		// The production build leaves out warnings and other code inside `if (__DEV__)`.
		{
			...shared,
			format: ["esm", "cjs"],
			cjsDefault: false,
			dts: true,
			minify: true,
			define: { __DEV__: "false" },
		},
		// Bundlers pick the development build through the `development` export condition, as Vite does while developing.
		{
			...shared,
			outDir: "dist/dev",
			clean: false,
			format: ["esm"],
			dts: false,
			minify: false,
			define: { __DEV__: "true" },
		},
	],
	define: {
		__DEV__: "true",
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
