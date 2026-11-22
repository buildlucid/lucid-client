import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		useTabs: true,
		printWidth: 80,
		sortImports: { newlinesBetween: false },
		sortPackageJson: false,
		ignorePatterns: ["**/*.md"],
	},
	lint: {
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: { "vite-plus/prefer-vite-plus-imports": "error" },
		options: { typeAware: true, typeCheck: true },
	},
});
