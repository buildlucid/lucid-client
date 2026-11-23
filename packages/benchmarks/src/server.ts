import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".map": "application/json",
};

/**
 * Serves the built pages. The isolation headers give `performance.now()` 5 µs
 * precision in Chromium instead of 100 µs.
 */
export const serve = async (dir: string) => {
	const server = createServer(async (request, response) => {
		const path = normalize(
			decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname),
		);
		// The pages have no icon. Without this, the browser logs a 404 for it.
		if (path === "/favicon.ico") {
			response.writeHead(204).end();
			return;
		}
		try {
			const body = await readFile(join(dir, path));
			response.writeHead(200, {
				"Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
				"Cross-Origin-Opener-Policy": "same-origin",
				"Cross-Origin-Embedder-Policy": "require-corp",
				"Cache-Control": "no-store",
			});
			response.end(body);
		} catch {
			response.writeHead(404).end();
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	return {
		origin: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
};
