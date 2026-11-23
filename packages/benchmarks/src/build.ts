import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The benchmarks package. */
export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Builds pages for production with `vp build`, into `outDir`. Builds every
 * page, or only `page`, such as `catalyst/pages/alpine/rows.html`.
 */
export const build = (outDir: string, page?: string) => {
	execFileSync(
		"npx",
		["vp", "build", "--logLevel", "warn", "--outDir", outDir],
		{
			cwd: root,
			stdio: "inherit",
			env: page ? { ...process.env, BENCHMARK_PAGE: page } : process.env,
		},
	);
};
