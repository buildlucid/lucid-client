import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { build } from "./build.ts";

type ManifestChunk = { file: string; imports?: string[] };

export type Size = { minBytes: number; gzipBytes: number; brotliBytes: number };

/**
 * Weighs the JavaScript a page loads: its entry and every chunk it imports,
 * minified by Vite, then compressed at the highest levels. The page is built
 * on its own into `outDir`, as a site with only that page would build it.
 */
export const measureSize = async (
	outDir: string,
	page: string,
): Promise<Size> => {
	build(outDir, page);
	const manifest: Record<string, ManifestChunk> = JSON.parse(
		await readFile(join(outDir, ".vite/manifest.json"), "utf8"),
	);
	const files = new Set<string>();
	const visit = (key: string) => {
		const chunk = manifest[key];
		if (!chunk) throw new Error(`The build has no chunk for ${key}`);
		if (chunk.file.endsWith(".js")) files.add(chunk.file);
		for (const imported of chunk.imports ?? []) visit(imported);
	};
	visit(page);

	const code = Buffer.concat(
		await Promise.all([...files].map((file) => readFile(join(outDir, file)))),
	);
	return {
		minBytes: code.length,
		gzipBytes: gzipSync(code, { level: 9 }).length,
		brotliBytes: brotliCompressSync(code, {
			params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
		}).length,
	};
};
