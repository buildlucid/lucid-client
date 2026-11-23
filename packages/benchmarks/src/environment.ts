import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";

/** The machine and browser a run used, for the results page. */
export const describeEnvironment = (browser: Browser) => ({
	browser: `Chromium ${browser.version()}`,
	node: process.versions.node,
	os: `${os.type()} ${os.release()} (${os.arch()})`,
	cpu: os.cpus()[0]?.model.trim() ?? "Unknown",
	cores: os.availableParallelism(),
	memoryGb: Math.round(os.totalmem() / 1024 ** 3),
});

export const gitCommit = () => {
	try {
		return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return null;
	}
};

/** The installed version of a package, read from its package.json. */
export const packageVersion = async (name: string) => {
	let dir = dirname(fileURLToPath(import.meta.resolve(name)));
	while (dir !== dirname(dir)) {
		try {
			const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
			if (pkg.name === name) return String(pkg.version);
		} catch {}
		dir = dirname(dir);
	}
	throw new Error(`Can't find the version of ${name}`);
};
