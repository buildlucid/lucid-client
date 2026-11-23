import { globSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const root = join(dirname(fileURLToPath(import.meta.url)), "src");

// One page, such as `catalyst/pages/alpine/rows.html`, to build on its own.
// The size check uses it, so a page's size doesn't include code it would only
// share with other pages.
const page = process.env.BENCHMARK_PAGE;

// Builds every suite's pages, one HTML page per library and fixture, as a
// production site would. The runner serves the output from dist.
export default defineConfig({
	root,
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		manifest: true,
		rolldownOptions: {
			input: page
				? [join(root, page)]
				: globSync("*/pages/**/*.html", { cwd: root }).map((file) =>
						join(root, file),
					),
		},
	},
	run: {
		tasks: {
			bench: {
				command: "node src/run.ts catalyst",
				dependsOn: ["@lucidclient/catalyst#build"],
				cache: false,
			},
		},
	},
});
