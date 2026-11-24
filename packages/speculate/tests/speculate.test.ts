import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import speculate, { type Options } from "../src/index.js";

type Rule = { source: string; eagerness: string; urls: string[] };
type RuleSet = Partial<Record<"prefetch" | "prerender", Rule[]>>;

/** An IntersectionObserver whose entries the tests report themselves, as happy-dom has no layout */
class TestObserver {
	static instances: TestObserver[] = [];
	observed = new Set<Element>();
	constructor(private callback: IntersectionObserverCallback) {
		TestObserver.instances.push(this);
	}
	observe(target: Element) {
		this.observed.add(target);
	}
	unobserve(target: Element) {
		this.observed.delete(target);
	}
	disconnect() {
		this.observed.clear();
	}
	takeRecords() {
		return [];
	}
	/** Reports the given elements as in view, if they are observed */
	intersect(targets: Element[]) {
		this.deliver(targets.filter((target) => this.observed.has(target)));
	}
	/** Reports the given elements as in view even when they are no longer observed, as entries queued before `disconnect` are */
	deliver(targets: Element[]) {
		const entries = targets.map(
			(target) =>
				({ isIntersecting: true, target }) as IntersectionObserverEntry,
		);
		this.callback(entries, this as unknown as IntersectionObserver);
	}
}

/** Reports elements as in view to the current observer */
const intersect = (...targets: Element[]) =>
	TestObserver.instances.at(-1)?.intersect(targets);

/** Stubs what the browser supports, which `init` reads */
const support = ({
	rules,
	linkPrefetch = false,
}: {
	rules: boolean;
	linkPrefetch?: boolean;
}) => {
	Object.defineProperty(HTMLScriptElement, "supports", {
		configurable: true,
		value: (type: string) => rules && type === "speculationrules",
	});
	// happy-dom doesn't expose DOMTokenList, so its prototype is read from a link.
	const tokenList = Object.getPrototypeOf(
		document.createElement("link").relList,
	) as DOMTokenList;
	vi.spyOn(tokenList, "supports").mockImplementation(
		(token: string) => linkPrefetch && token === "prefetch",
	);
};

/** Initialises the library and runs the scan it waits to run when idle */
const init = (options?: Options) => {
	speculate.init(options);
	vi.runOnlyPendingTimers();
};

const $ = <E extends Element = HTMLAnchorElement>(selector: string) =>
	document.querySelector<E>(selector) as E;

const ruleSets = () =>
	Array.from(
		document.head.querySelectorAll<HTMLScriptElement>(
			'script[type="speculationrules"][data-speculate--generated]',
		),
		(script) => JSON.parse(script.textContent ?? "{}") as RuleSet,
	);

/** Every rule in every rule set, for an action */
const rulesFor = (action: "prefetch" | "prerender") =>
	ruleSets().flatMap((ruleSet) => ruleSet[action] ?? []);

/** The eagerness of the rule that speculates a path, for an action */
const eagernessOf = (action: "prefetch" | "prerender", path: string) =>
	rulesFor(action).find((rule) =>
		rule.urls.some((url) => new URL(url).pathname === path),
	)?.eagerness;

const allUrls = () =>
	ruleSets().flatMap((ruleSet) =>
		[...(ruleSet.prefetch ?? []), ...(ruleSet.prerender ?? [])].flatMap(
			(rule) => rule.urls,
		),
	);

const prefetchLinks = () =>
	Array.from(
		document.head.querySelectorAll<HTMLLinkElement>(
			'link[rel="prefetch"][data-speculate--generated]',
		),
		(link) => new URL(link.href).pathname,
	);

const mouseOver = (target: Element, relatedTarget: Element | null = null) =>
	target.dispatchEvent(
		new MouseEvent("mouseover", { bubbles: true, relatedTarget }),
	);

const mouseOut = (target: Element, relatedTarget: Element | null = null) =>
	target.dispatchEvent(
		new MouseEvent("mouseout", { bubbles: true, relatedTarget }),
	);

const warnings = () =>
	vi.mocked(console.warn).mock.calls.map(([message]) => String(message));

beforeEach(() => {
	vi.useFakeTimers();
	// The scan then waits for a timeout, which the fake timers run.
	vi.stubGlobal("requestIdleCallback", undefined);
	vi.stubGlobal("IntersectionObserver", TestObserver);
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	TestObserver.instances = [];
});

afterEach(() => {
	speculate.destroy();
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("with Speculation Rules", () => {
	beforeEach(() => support({ rules: true }));

	it("reads the action from the specifier and the trigger from the value", () => {
		document.body.innerHTML = `
			<a href="/prerender" data-speculate--prerender="immediate">Prerender</a>
			<a href="/prefetch" data-speculate--prefetch="eager">Prefetch</a>`;

		init();

		expect(eagernessOf("prerender", "/prerender")).toBe("immediate");
		// A prerender also gets a prefetch, as another candidate the browser can use.
		expect(eagernessOf("prefetch", "/prerender")).toBe("immediate");
		expect(eagernessOf("prerender", "/prefetch")).toBeUndefined();
		expect(eagernessOf("prefetch", "/prefetch")).toBe("eager");
	});

	it("prefetches a bare data-speculate link, and uses moderate for an empty or unknown trigger", () => {
		document.body.innerHTML = `
			<a href="/default" data-speculate>Default</a>
			<a href="/eager" data-speculate="eager">Eager</a>
			<a href="/unknown" data-speculate="whenever">Unknown</a>`;

		init();

		expect(eagernessOf("prefetch", "/default")).toBe("moderate");
		expect(eagernessOf("prefetch", "/eager")).toBe("eager");
		expect(eagernessOf("prefetch", "/unknown")).toBe("moderate");
		expect(warnings()).toContainEqual(
			expect.stringContaining('unknown trigger, "whenever"'),
		);
	});

	it("prefers prerender when a link has both actions", () => {
		document.body.innerHTML = `<a href="/both" data-speculate--prefetch="eager" data-speculate--prerender="immediate">Both</a>`;

		init();

		expect(eagernessOf("prerender", "/both")).toBe("immediate");
	});

	it("adds every link to one rule set, grouped by eagerness", () => {
		document.body.innerHTML = `
			<a href="/one" data-speculate="eager">One</a>
			<a href="/two" data-speculate="eager">Two</a>
			<a href="/three" data-speculate="moderate">Three</a>`;

		init();

		expect(ruleSets()).toHaveLength(1);
		expect(rulesFor("prefetch")).toEqual([
			{
				source: "list",
				eagerness: "eager",
				urls: ["https://example.com/one", "https://example.com/two"],
			},
			{
				source: "list",
				eagerness: "moderate",
				urls: ["https://example.com/three"],
			},
		]);
	});

	it("keeps the link's hash in every rule, as the browser matches the full URL", () => {
		document.body.innerHTML = `
			<a href="/guide#setup" data-speculate>Setup</a>
			<a href="/guide#setup" data-speculate>Setup again</a>
			<a href="/page#intro" data-speculate="immediate">Intro</a>
			<a id="visible" href="/visible#more" data-speculate="visible">More</a>`;

		init();
		intersect($("#visible"));

		expect(allUrls()).toEqual([
			"https://example.com/guide#setup",
			"https://example.com/page#intro",
			"https://example.com/visible#more",
		]);
	});

	it("doesn't add a rule that an earlier one already has", () => {
		document.body.innerHTML = `
			<a href="/guide" data-speculate="immediate">Prefetch</a>
			<a href="/guide" data-speculate--prerender="immediate">Prerender</a>
			<a id="visible" href="/guide" data-speculate="visible">Visible</a>`;

		init();
		intersect($("#visible"));

		expect(ruleSets()).toHaveLength(1);
		expect(rulesFor("prefetch")).toEqual([
			{
				source: "list",
				eagerness: "immediate",
				urls: ["https://example.com/guide"],
			},
		]);
	});

	it("skips the current page, but keeps it with a different query", () => {
		document.body.innerHTML = `
			<a href="/" data-speculate>Home</a>
			<a href="/#top" data-speculate>Top</a>
			<a href="/?page=2" data-speculate>Page 2</a>`;

		init();

		expect(allUrls()).toEqual(["https://example.com/?page=2"]);
	});

	it("skips links it can't speculate, and says why", () => {
		document.body.innerHTML = `
			<a href="https://other.example/page" data-speculate>Other site</a>
			<a href="/new-tab" target="_blank" data-speculate>New tab</a>
			<a href="/file.pdf" download data-speculate>Download</a>
			<a href="mailto:hello@example.com" data-speculate>Email</a>
			<a href="javascript:void(0)" data-speculate>Script</a>
			<a href="/self" target="_SELF" data-speculate>Self</a>`;

		init();

		expect(allUrls()).toEqual(["https://example.com/self"]);
		expect(warnings()).toEqual(
			expect.arrayContaining([
				expect.stringContaining("goes to another origin"),
				expect.stringContaining("opens in another tab or window"),
				expect.stringContaining("downloads a file"),
				expect.stringContaining("isn't an http or https link"),
			]),
		);
	});

	it("skips links that open in a new tab from <base target>", () => {
		document.head.innerHTML = `<base target="_blank" />`;
		document.body.innerHTML = `
			<a href="/inherited" data-speculate>Inherited</a>
			<a href="/own" target="_self" data-speculate>Own target</a>`;

		init();

		expect(allUrls()).toEqual(["https://example.com/own"]);
	});

	it("warns about speculate attributes on an element that isn't a link", () => {
		document.body.innerHTML = `<button data-speculate>Button</button>`;

		init();

		expect(ruleSets()).toHaveLength(0);
		expect(warnings()).toContainEqual(
			expect.stringContaining(
				"only work on links, but one was found on a <button>",
			),
		);
	});

	it("speculates visible links once they scroll into view, together", () => {
		document.body.innerHTML = `
			<a id="a" href="/a" data-speculate--prerender="visible">A</a>
			<a id="b" href="/b" data-speculate="visible">B</a>`;

		init();
		expect(ruleSets()).toHaveLength(0);

		intersect($("#a"), $("#b"));

		expect(ruleSets()).toHaveLength(1);
		expect(eagernessOf("prerender", "/a")).toBe("immediate");
		expect(eagernessOf("prefetch", "/b")).toBe("immediate");
	});

	it("waits for the browser to be idle before setting up links", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="eager">Page</a>`;

		speculate.init();
		expect(ruleSets()).toHaveLength(0);

		vi.runOnlyPendingTimers();
		expect(ruleSets()).toHaveLength(1);
	});

	it("doesn't set up links when destroyed before the browser is idle", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="eager">Page</a>`;

		speculate.init();
		speculate.destroy();
		vi.runOnlyPendingTimers();

		expect(ruleSets()).toHaveLength(0);
	});

	it("cancels the idle callback on destroy where requestIdleCallback is supported", () => {
		const requestIdleCallback = vi.fn(() => 7);
		const cancelIdleCallback = vi.fn();
		vi.stubGlobal("requestIdleCallback", requestIdleCallback);
		vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

		speculate.init();
		expect(requestIdleCallback).toHaveBeenCalledOnce();

		speculate.destroy();
		expect(cancelIdleCallback).toHaveBeenCalledWith(7);
	});

	it("ignores entries the observer queued before destroy", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="visible">Page</a>`;
		init();
		const observer = TestObserver.instances.at(-1);

		speculate.destroy();
		observer?.deliver([$("a")]);

		expect(ruleSets()).toHaveLength(0);
	});

	it("ignores entries the observer queued for links that left the page before a refresh", () => {
		document.body.innerHTML = `<a href="/gone" data-speculate="visible">Gone</a>`;
		init();
		const observer = TestObserver.instances.at(-1);
		const gone = $("a");
		gone.remove();

		speculate.refresh();
		observer?.deliver([gone]);

		expect(ruleSets()).toHaveLength(0);
	});

	it("speculates a link's new destination on refresh", () => {
		document.body.innerHTML = `<a href="/first" data-speculate="eager">Link</a>`;
		init();

		$("a").setAttribute("href", "/second");
		speculate.refresh();

		expect(allUrls()).toEqual([
			"https://example.com/first",
			"https://example.com/second",
		]);
	});

	it("picks up new links on refresh, without speculating the others again", () => {
		document.body.innerHTML = `<a href="/first" data-speculate="eager">First</a>`;
		init();

		document.body.insertAdjacentHTML(
			"beforeend",
			`<a href="/second" data-speculate="eager">Second</a>`,
		);
		speculate.refresh();

		expect(ruleSets()).toHaveLength(2);
		expect(allUrls()).toEqual([
			"https://example.com/first",
			"https://example.com/second",
		]);
	});

	it("lets go of visible links that left the page on refresh", () => {
		document.body.innerHTML = `<a id="gone" href="/gone" data-speculate="visible">Gone</a>`;
		init();
		const original = TestObserver.instances.at(-1);
		const gone = $("#gone");
		expect(original?.observed.has(gone)).toBe(true);
		gone.remove();

		speculate.refresh();

		expect(original?.observed.has(gone)).toBe(false);
		expect(TestObserver.instances.at(-1)?.observed.has(gone)).toBe(false);
	});

	it("doesn't speculate a visible link that stopped asking to before it scrolled into view", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="visible">Page</a>`;
		init();

		$("a").removeAttribute("data-speculate");
		intersect($("a"));

		expect(ruleSets()).toHaveLength(0);
	});

	it("doesn't speculate a visible link whose trigger changed before it scrolled into view", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="visible">Page</a>`;
		init();

		$("a").setAttribute("data-speculate", "moderate");
		intersect($("a"));

		expect(ruleSets()).toHaveLength(0);
	});

	it("removes the rule sets it added on destroy", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="eager">Page</a>`;
		init();
		expect(ruleSets()).toHaveLength(1);

		speculate.destroy();

		expect(ruleSets()).toHaveLength(0);
	});

	it("starts over when initialised again", () => {
		document.body.innerHTML = `<a href="/first" data-speculate="eager">Link</a>`;
		init();
		expect(allUrls()).toEqual(["https://example.com/first"]);

		$("a").setAttribute("href", "/second");
		init();

		// The first rule set is removed, and the link is read again.
		expect(ruleSets()).toHaveLength(1);
		expect(allUrls()).toEqual(["https://example.com/second"]);
	});

	it("does nothing for visitors who are offline", () => {
		vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
		document.body.innerHTML = `<a href="/page" data-speculate="eager">Page</a>`;

		init();

		expect(ruleSets()).toHaveLength(0);
		expect(console.info).toHaveBeenCalledWith(
			"[Speculate] Links aren't speculated, as the device is offline.",
		);
	});

	it("warns when refresh is called before init", () => {
		speculate.refresh();

		expect(warnings()).toEqual(["[Speculate] Call init before refreshing."]);
	});
});

describe("without Speculation Rules", () => {
	beforeEach(() => support({ rules: false, linkPrefetch: true }));

	it("prefetches a link once the pointer rests on it for the hover delay", () => {
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		mouseOver($("a"));
		vi.advanceTimersByTime(199);
		expect(prefetchLinks()).toEqual([]);

		vi.advanceTimersByTime(1);
		expect(prefetchLinks()).toEqual(["/page"]);
		expect(ruleSets()).toHaveLength(0);
	});

	it("cancels the prefetch when the pointer leaves the link first", () => {
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		mouseOver($("a"));
		mouseOut($("a"), document.body);
		vi.advanceTimersByTime(200);

		expect(prefetchLinks()).toEqual([]);
	});

	it("keeps the hover delay going while the pointer moves inside the link", () => {
		document.body.innerHTML = `<a href="/page" data-speculate><span>Page</span></a>`;
		init();
		const span = $<HTMLSpanElement>("span");

		mouseOver($("a"));
		vi.advanceTimersByTime(100);
		mouseOut($("a"), span);
		mouseOver(span, $("a"));
		vi.advanceTimersByTime(100);

		expect(prefetchLinks()).toEqual(["/page"]);
	});

	it("uses the hoverDelay option", () => {
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init({ hoverDelay: 50 });

		mouseOver($("a"));
		vi.advanceTimersByTime(50);

		expect(prefetchLinks()).toEqual(["/page"]);
	});

	it("prefetches straight away when a link, or markup inside it, is pressed or focused", () => {
		document.body.innerHTML = `
			<a href="/pressed" data-speculate><span>Pressed</span></a>
			<a href="/focused" data-speculate>Focused</a>`;
		init();

		$("span").dispatchEvent(new Event("pointerdown", { bubbles: true }));
		$('[href="/focused"]').dispatchEvent(
			new FocusEvent("focusin", { bubbles: true }),
		);

		expect(prefetchLinks()).toEqual(["/pressed", "/focused"]);
	});

	it("works for links added after init without a refresh", () => {
		init();
		document.body.innerHTML = `<a href="/late" data-speculate>Late</a>`;

		$("a").dispatchEvent(new Event("pointerdown", { bubbles: true }));

		expect(prefetchLinks()).toEqual(["/late"]);
	});

	it("prefetches a prerender link, and waits for intent with an unsupported trigger", () => {
		document.body.innerHTML = `<a href="/page" data-speculate--prerender="immediate">Page</a>`;
		init();
		expect(prefetchLinks()).toEqual([]);

		$("a").dispatchEvent(new Event("pointerdown", { bubbles: true }));

		expect(prefetchLinks()).toEqual(["/page"]);
		expect(ruleSets()).toHaveLength(0);
	});

	it("prefetches visible links once they scroll into view", () => {
		document.body.innerHTML = `<a href="/page" data-speculate="visible">Page</a>`;
		init();

		intersect($("a"));

		expect(prefetchLinks()).toEqual(["/page"]);
	});

	it("prefetches a URL once, without its hash", () => {
		document.body.innerHTML = `
			<a id="a" href="/page#more" data-speculate>More</a>
			<a id="b" href="/page" data-speculate>Page</a>`;
		init();

		const hrefs = () =>
			Array.from(
				document.head.querySelectorAll<HTMLLinkElement>("link[rel=prefetch]"),
				(link) => link.href,
			);

		$("#a").dispatchEvent(new Event("pointerdown", { bubbles: true }));
		expect(hrefs()).toEqual(["https://example.com/page"]);

		$("#b").dispatchEvent(new Event("pointerdown", { bubbles: true }));
		expect(hrefs()).toEqual(["https://example.com/page"]);
	});

	it("doesn't prefetch a link that left the page while the pointer rested on it", () => {
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		mouseOver($("a"));
		$("a").remove();
		vi.advanceTimersByTime(200);

		expect(prefetchLinks()).toEqual([]);
	});

	it("doesn't prefetch a link that stopped asking to while the pointer rested on it", () => {
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		mouseOver($("a"));
		$("a").removeAttribute("data-speculate");
		vi.advanceTimersByTime(200);

		expect(prefetchLinks()).toEqual([]);
	});

	it("finds the link around markup that has a speculate attribute by mistake", () => {
		document.body.innerHTML = `<a href="/page" data-speculate><span data-speculate>Page</span></a>`;
		init();

		$("span").dispatchEvent(new Event("pointerdown", { bubbles: true }));

		expect(prefetchLinks()).toEqual(["/page"]);
	});

	it("prefetches a link focused before it had an href once it has one", () => {
		document.body.innerHTML = `<a data-speculate>Page</a>`;
		init();
		const focus = () =>
			$("a").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

		focus();
		$("a").setAttribute("href", "/page");
		focus();

		expect(prefetchLinks()).toEqual(["/page"]);
	});

	it("stops listening on destroy", () => {
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();
		mouseOver($("a"));

		speculate.destroy();
		vi.advanceTimersByTime(200);
		$("a").dispatchEvent(new Event("pointerdown", { bubbles: true }));

		expect(prefetchLinks()).toEqual([]);
	});
});

describe("without Speculation Rules or link prefetch", () => {
	beforeEach(() => support({ rules: false, linkPrefetch: false }));

	it("prefetches with a low priority fetch", () => {
		const fetch = vi.fn(async () => new Response());
		vi.stubGlobal("fetch", fetch);
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		$("a").dispatchEvent(new Event("pointerdown", { bubbles: true }));

		expect(fetch).toHaveBeenCalledWith(
			"https://example.com/page",
			expect.objectContaining({ priority: "low" }),
		);
	});

	it("cancels a prefetch in flight on destroy, without an unhandled rejection", async () => {
		let signal: AbortSignal | undefined;
		// Rejects once its signal aborts, as a real fetch does. Vitest fails the run on an unhandled rejection.
		const fetch = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					signal = init?.signal ?? undefined;
					signal?.addEventListener("abort", () =>
						reject(new DOMException("Aborted", "AbortError")),
					);
				}),
		);
		vi.stubGlobal("fetch", fetch);
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		$("a").dispatchEvent(new Event("pointerdown", { bubbles: true }));
		expect(signal?.aborted).toBe(false);

		speculate.destroy();
		expect(signal?.aborted).toBe(true);
		await Promise.resolve();
	});

	it("ignores a prefetch that fails", async () => {
		const fetch = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		vi.stubGlobal("fetch", fetch);
		document.body.innerHTML = `<a href="/page" data-speculate>Page</a>`;
		init();

		$("a").dispatchEvent(new Event("pointerdown", { bubbles: true }));
		await Promise.resolve();

		expect(fetch).toHaveBeenCalledOnce();
	});
});
