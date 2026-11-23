import { afterEach, describe, expect, it, vi } from "vite-plus/test";

type Rules = Record<
	"prefetch" | "prerender",
	Array<{ urls: string[]; eagerness?: string }> | undefined
>;

/**
 * Speculate checks for Speculation Rules support when it is imported, so each
 * test imports a fresh copy with support stubbed.
 */
const load = async (rulesSupported: boolean) => {
	vi.resetModules();
	Object.defineProperty(HTMLScriptElement, "supports", {
		configurable: true,
		value: (type: string) => rulesSupported && type === "speculationrules",
	});
	const { speculateLinks } = await import("../src/index.js");
	return speculateLinks;
};

/** Runs speculateLinks and waits for its idle callback. */
const run = async (speculateLinks: () => () => void) => {
	const destroy = speculateLinks();
	await new Promise((resolve) => setTimeout(resolve, 0));
	return destroy;
};

const rules = () =>
	Array.from(
		document.head.querySelectorAll<HTMLScriptElement>(
			'script[type="speculationrules"][gen-speculate]',
		),
		(script) => JSON.parse(script.textContent ?? "{}") as Rules,
	);

const ruleFor = (path: string) =>
	rules().find((rule) =>
		[...(rule.prefetch ?? []), ...(rule.prerender ?? [])].some((item) =>
			item.urls.some((url) => new URL(url).pathname === path),
		),
	);

let destroy: (() => void) | undefined;

afterEach(() => {
	destroy?.();
	destroy = undefined;
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	vi.unstubAllGlobals();
});

describe("speculateLinks with Speculation Rules", () => {
	it("reads the action from the specifier and the trigger from the value", async () => {
		const speculateLinks = await load(true);
		document.body.innerHTML = `
			<a href="/prerender" data-speculate--prerender="immediate">Prerender</a>
			<a href="/prefetch" data-speculate--prefetch="eager">Prefetch</a>`;

		destroy = await run(speculateLinks);

		const prerender = ruleFor("/prerender");
		expect(prerender?.prerender?.[0]?.eagerness).toBe("immediate");
		// prefetch is added as a fallback for a prerender that fails
		expect(prerender?.prefetch?.[0]?.eagerness).toBe("immediate");

		const prefetch = ruleFor("/prefetch");
		expect(prefetch?.prerender).toBeUndefined();
		expect(prefetch?.prefetch?.[0]?.eagerness).toBe("eager");
	});

	it("prefetches a bare data-speculate link, with its value as the trigger", async () => {
		const speculateLinks = await load(true);
		document.body.innerHTML = `
			<a href="/default" data-speculate>Default</a>
			<a href="/eager" data-speculate="eager">Eager</a>
			<a href="/unknown" data-speculate="whenever">Unknown</a>`;

		destroy = await run(speculateLinks);

		expect(ruleFor("/default")?.prefetch?.[0]?.eagerness).toBe("moderate");
		expect(ruleFor("/eager")?.prefetch?.[0]?.eagerness).toBe("eager");
		expect(ruleFor("/unknown")?.prefetch?.[0]?.eagerness).toBe("moderate");
	});

	it("prefers prerender when a link has both actions", async () => {
		const speculateLinks = await load(true);
		document.body.innerHTML = `<a href="/both" data-speculate--prefetch="eager" data-speculate--prerender="immediate">Both</a>`;

		destroy = await run(speculateLinks);

		expect(ruleFor("/both")?.prerender?.[0]?.eagerness).toBe("immediate");
	});

	it("no longer reads rel", async () => {
		const speculateLinks = await load(true);
		document.body.innerHTML = `<a href="/rel" rel="prefetch:immediate">Rel</a>`;

		destroy = await run(speculateLinks);

		expect(rules()).toHaveLength(0);
	});
});

describe("speculateLinks without Speculation Rules", () => {
	it("falls back to prefetching on intent", async () => {
		const fetch = vi.fn(async () => new Response());
		vi.stubGlobal("fetch", fetch);
		const speculateLinks = await load(false);
		document.body.innerHTML = `<a href="/fallback" data-speculate--prerender="immediate">Fallback</a>`;

		destroy = await run(speculateLinks);
		const prefetched = () =>
			document.head.querySelector("link[gen-speculate]") !== null ||
			fetch.mock.calls.length > 0;
		expect(prefetched()).toBe(false);

		document.querySelector("a")?.dispatchEvent(new MouseEvent("mouseenter"));

		expect(rules()).toHaveLength(0);
		expect(prefetched()).toBe(true);
	});
});
