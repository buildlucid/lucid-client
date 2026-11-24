import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The benchmarks package. */
export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Builds pages for production with `vp build`, into `outDir`. Builds every
 * page, or only `page`, such as `catalyst/pages/alpine/rows.html`.
 */
const args = (outDir: string) => [
	"vp",
	"build",
	"--logLevel",
	"warn",
	"--outDir",
	outDir,
];
const env = (page?: string) =>
	page ? { ...process.env, BENCHMARK_PAGE: page } : process.env;

export const build = (outDir: string, page?: string) => {
	execFileSync("npx", args(outDir), {
		cwd: root,
		stdio: "inherit",
		env: env(page),
	});
};

/** Builds like `build`, without blocking, so several pages can build at once */
export const buildAsync = (outDir: string, page?: string) =>
	new Promise<void>((resolve, reject) => {
		const child = spawn("npx", args(outDir), {
			cwd: root,
			stdio: "inherit",
			env: env(page),
		});
		child.on("error", reject);
		child.on("exit", (code) =>
			code === 0
				? resolve()
				: reject(new Error(`Building ${page ?? "the pages"} failed`)),
		);
	});
