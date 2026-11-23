import { Speculator, speculateLinks } from "@lucidclient/speculate";
import { createLogger, formatData } from "../lib/log";
import { targetLinks } from "./speculate-links";

const linksLog = createLogger("speculateLinks");
const speculatorLog = createLogger("Speculator");

const $ = <E extends Element = HTMLElement>(selector: string) =>
	document.querySelector<E>(selector);
const $$ = <E extends Element = HTMLElement>(selector: string) =>
	Array.from(document.querySelectorAll<E>(selector));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const timeNow = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

// ========================================================
// Link speculation

// --------------------------------------------------------
// Support, mirroring the checks Speculate makes

type ConnectionInfo = { saveData?: boolean; effectiveType?: string };
const connection = (navigator as Navigator & { connection?: ConnectionInfo })
	.connection;

const rulesSupported =
	typeof HTMLScriptElement.supports === "function" &&
	HTMLScriptElement.supports("speculationrules");
const linkPrefetchSupported =
	document.createElement("link").relList?.supports?.("prefetch") ?? false;
const slowConnection = /(2|3)g/.test(connection?.effectiveType ?? "");
const willRun = navigator.onLine && !connection?.saveData && !slowConnection;

const setSupport = (key: string, text: string, ok: boolean | null) => {
	const element = $(`[data-support="${key}"]`);
	if (!element) return;
	element.textContent = text;
	element.dataset.ok = ok === null ? "neutral" : String(ok);
};

setSupport(
	"rules",
	rulesSupported ? "Supported" : "Not supported",
	rulesSupported,
);
setSupport(
	"link",
	linkPrefetchSupported ? "Supported" : "Not supported",
	linkPrefetchSupported,
);
setSupport(
	"path",
	rulesSupported
		? "Speculation Rules"
		: linkPrefetchSupported
			? '<link rel="prefetch">'
			: "Low-priority fetch",
	null,
);
setSupport("online", navigator.onLine ? "Online" : "Offline", navigator.onLine);
setSupport(
	"save-data",
	connection?.saveData ? "On" : connection ? "Off" : "Not reported",
	connection ? !connection.saveData : null,
);
setSupport(
	"effective-type",
	connection?.effectiveType ?? "Not reported",
	connection?.effectiveType ? !slowConnection : null,
);
setSupport("will-run", willRun ? "Yes" : "No, see the console", willRun);

// --------------------------------------------------------
// The links table: what each link resolves to, and whether it was speculated

const absolute = (href: string) => new URL(href, location.href).href;
const linkByHref = new Map(
	targetLinks.map((link) => [absolute(link.href), link] as const),
);

/** Mirrors Speculate's parseLinkConfig fallbacks. */
const effectiveConfig = (link: (typeof targetLinks)[number]) => {
	if (!link.action || !link.trigger) return "Not speculated";
	let action: string = link.action;
	let trigger: string = link.trigger;
	if (!rulesSupported) {
		action = "prefetch";
		if (trigger !== "visible" && trigger !== "moderate") trigger = "moderate";
	}
	return `${action} · ${trigger}`;
};

for (const link of targetLinks) {
	const cell = $(`[data-effective="${link.id}"]`);
	if (cell) cell.textContent = effectiveConfig(link);
}

const fetched = new Set<string>();
const originalFetch = window.fetch.bind(window);
// Speculate's last fallback is a low-priority fetch, which isn't visible in
// the DOM, so it is noted here.
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input.url;
	const href = absolute(url);
	const link = linkByHref.get(href);
	if (link) {
		fetched.add(href);
		linksLog.info(`Fallback fetch for ${link.href}`, {
			priority: init?.priority,
		});
		renderInjected();
	}
	return originalFetch(input, init);
};

type RuleSet = Partial<
	Record<
		"prefetch" | "prerender",
		Array<{ urls?: string[]; eagerness?: string }>
	>
>;

const renderInjected = () => {
	const statuses = new Map<string, string[]>();
	const add = (href: string, status: string) => {
		statuses.set(href, [...(statuses.get(href) ?? []), status]);
	};

	const injected = $$("head [gen-speculate]");
	const blocks: string[] = [];
	for (const element of injected) {
		if (element instanceof HTMLScriptElement) {
			let rules: RuleSet = {};
			try {
				rules = JSON.parse(element.textContent ?? "{}") as RuleSet;
			} catch {
				// Leave unparseable rules out of the statuses.
			}
			for (const type of ["prerender", "prefetch"] as const) {
				for (const rule of rules[type] ?? []) {
					for (const url of rule.urls ?? []) {
						add(
							absolute(url),
							`${type}${rule.eagerness ? ` (${rule.eagerness})` : ""}`,
						);
					}
				}
			}
			blocks.push(
				`<script type="speculationrules">\n${JSON.stringify(rules, null, 2)}\n</script>`,
			);
		} else if (element instanceof HTMLLinkElement) {
			add(absolute(element.href), '<link rel="prefetch">');
			blocks.push(element.outerHTML);
		}
	}
	for (const href of fetched) add(href, "fetch");

	const view = $("[data-injected]");
	if (view) {
		view.textContent = blocks.length
			? blocks.join("\n\n")
			: "Nothing injected yet.";
	}
	const count = $("[data-injected-count]");
	if (count) count.textContent = String(injected.length);

	for (const link of targetLinks) {
		const cell = $(`[data-status="${link.id}"]`);
		if (!cell) continue;
		const status = statuses.get(absolute(link.href));
		cell.textContent = status ? status.join(" + ") : "Waiting";
		cell.dataset.speculated = String(Boolean(status));
	}
};

new MutationObserver(renderInjected).observe(document.head, {
	childList: true,
});
renderInjected();

// --------------------------------------------------------
// Destroy and initialise again

let destroyLinks: (() => void) | null = speculateLinks();
linksLog.info("speculateLinks() called");

const renderLinksState = () => {
	const pill = $("[data-links-state]");
	if (!pill) return;
	pill.textContent = destroyLinks ? "initialised" : "destroyed";
	pill.dataset.running = String(Boolean(destroyLinks));
};
renderLinksState();

for (const button of $$<HTMLButtonElement>("[data-links-action]")) {
	button.addEventListener("click", () => {
		if (button.dataset.linksAction === "destroy") {
			destroyLinks?.();
			destroyLinks = null;
			fetched.clear();
			linksLog.info("destroy() removed the injected rules and links");
		} else {
			destroyLinks?.();
			destroyLinks = speculateLinks();
			linksLog.info("speculateLinks() called again");
		}
		renderLinksState();
		renderInjected();
	});
}

// ========================================================
// Data prefetching with Speculator

type PageData = { page: number; fetchedAt: string; items: string[] };
type PageError = { page: string | null };

/** Speculator keeps its cache private; the page reads it to show hits. */
type CacheView = Map<string, { timestamp: number; promise: Promise<unknown> }>;
const readCache = (instance: object) =>
	(instance as { cache?: CacheView }).cache ?? new Map();

/** Records why the next fetch for a key happens: a click, a hover or a call. */
const intents = new Map<string, { kind: string; at: number }>();
const describeIntent = (key: string | null) => {
	const intent = key ? intents.get(key) : undefined;
	if (!intent || performance.now() - intent.at > 5000)
		return "optimistic or idle";
	if (key) intents.delete(key);
	return `${intent.kind}, ${Math.round(performance.now() - intent.at)}ms after it`;
};

const createFetcher =
	(
		attribute: string,
		latency: () => number,
		log = speculatorLog,
		trackIntent = true,
	) =>
	async (element: Element) => {
		const page = element.getAttribute(attribute);
		log.info(`fetch() called for page ${page ?? "null"}`, {
			element,
			...(trackIntent && { reason: describeIntent(page) }),
			latency: `${latency()}ms`,
		});
		await sleep(latency());
		if (page === null) {
			return {
				data: undefined,
				error: {
					message: `fetch() received an element without ${attribute}`,
					details: { page },
				},
			};
		}
		if (page === "1") {
			return {
				data: undefined,
				error: { message: "Page 1 always fails", details: { page } },
			};
		}
		return {
			data: {
				page: Number(page),
				fetchedAt: timeNow(),
				items: Array.from(
					{ length: 3 },
					(_, index) => `Result ${(Number(page) - 1) * 3 + index + 1}`,
				),
			},
			error: undefined,
		};
	};

// --------------------------------------------------------
// Pagination

const paginator = $("[data-paginator]");
const pageButtons = $$<HTMLButtonElement>("[data-paginator] [data-page]");
const pageOutput = $("[data-page-output]");
const latencyInput = $<HTMLInputElement>("[data-option='latency']");
const latencyOutput = $("[data-option-output='latency']");
const maxSizeInput = $<HTMLInputElement>("[data-option='max-size']");
const staleTimeInput = $<HTMLInputElement>("[data-option='stale-time']");
const optimisticInput = $<HTMLInputElement>("[data-option='optimistic']");

const latency = () => Number(latencyInput?.value ?? 800);
latencyInput?.addEventListener("input", () => {
	if (latencyOutput) latencyOutput.textContent = `${latency()}ms`;
});

const pageButton = (page: number) =>
	pageButtons.find((button) => button.dataset.page === String(page));

let paginatorConfig = { maxSize: 3, staleTime: 15000 };
let destroyed = false;
const clicks = new Map<string, { at: number; cached: boolean }>();

/** What Speculator resolves with. The package doesn't export `IntentResult`. */
type PageResult = Awaited<
	ReturnType<Speculator<PageData, PageError>["prefetch"]>
>;

const renderPage = (result: PageResult) => {
	if (!pageOutput) return;
	pageOutput.dataset.error = String(Boolean(result.error));
	pageOutput.textContent = result.error
		? `Error: ${result.error.message}`
		: `Page ${result.data.page}, fetched at ${result.data.fetchedAt}\n${result.data.items.map((item) => `· ${item}`).join("\n")}`;
};

const createPaginator = () =>
	new Speculator<PageData, PageError>({
		elements: pageButtons,
		optimistic: {
			elements: pageButton(2),
			condition: () => optimisticInput?.checked ?? false,
		},
		fetch: createFetcher("data-page", latency),
		getCacheKey: (element) => element.getAttribute("data-page"),
		cache: paginatorConfig,
		onClick: (event, result) => {
			// onClick runs after the fetch settles, when currentTarget is no
			// longer set, so the page is found from the clicked element.
			const key =
				event.target instanceof Element
					? (event.target.closest("[data-page]")?.getAttribute("data-page") ??
						null)
					: null;
			const click = key ? clicks.get(key) : undefined;
			const waited = click ? Math.round(performance.now() - click.at) : 0;
			const message = `onClick for page ${key} after ${waited}ms (${click?.cached ? "served from the cache" : "waited for fetch"})`;
			if (result.error) speculatorLog.warn(message, result.error);
			else speculatorLog.success(message);
			renderPage(result);
		},
	});

let speculator = createPaginator();
speculatorLog.info("new Speculator() for the pagination buttons", {
	...paginatorConfig,
	optimistic: optimisticInput?.checked,
});

// Capture runs before Speculator's own click listener, so the cache can be
// read before the click fills it.
paginator?.addEventListener(
	"click",
	(event) => {
		const button =
			event.target instanceof Element
				? event.target.closest<HTMLElement>("[data-page]")
				: null;
		const key = button?.dataset.page;
		if (!key) return;
		const entry = readCache(speculator).get(key);
		const cached =
			entry !== undefined &&
			Date.now() - entry.timestamp <= paginatorConfig.staleTime;
		clicks.set(key, { at: performance.now(), cached });
		intents.set(key, { kind: "click", at: performance.now() });
		if (destroyed) {
			speculatorLog.warn(
				`Clicked page ${key}, but the Speculator is destroyed, so nothing handles it`,
			);
		}
	},
	{ capture: true },
);
paginator?.addEventListener("mouseover", (event) => {
	const key =
		event.target instanceof HTMLElement ? event.target.dataset.page : undefined;
	if (key && !intents.has(key))
		intents.set(key, { kind: "hover", at: performance.now() });
});

// --------------------------------------------------------
// The cache view

const settled = new WeakSet<Promise<unknown>>();
const watched = new WeakSet<Promise<unknown>>();
const renderCache = () => {
	const body = $("[data-cache-rows]");
	if (!body) return;
	const cache = readCache(speculator);
	const rows = Array.from(cache.entries()).map(([key, entry]) => {
		if (!watched.has(entry.promise)) {
			watched.add(entry.promise);
			void entry.promise.finally(() => settled.add(entry.promise));
		}
		const age = (Date.now() - entry.timestamp) / 1000;
		const stale = Date.now() - entry.timestamp > paginatorConfig.staleTime;
		const row = document.createElement("tr");
		row.className = "border-t border-line/60";
		for (const [text, className] of [
			[`page ${key}`, "text-fg"],
			[`${age.toFixed(1)}s`, "tabular-nums"],
			[settled.has(entry.promise) ? "settled" : "in flight", ""],
			[
				stale ? "stale" : "fresh",
				stale ? "text-amber-300" : "text-emerald-300",
			],
		] as const) {
			const cell = document.createElement("td");
			cell.className = `px-3 py-1.5 ${className}`;
			cell.textContent = text;
			row.append(cell);
		}
		return row;
	});
	if (rows.length === 0) {
		const row = document.createElement("tr");
		const cell = document.createElement("td");
		cell.colSpan = 4;
		cell.className = "px-3 py-2 text-subtle";
		cell.textContent = destroyed ? "Destroyed: the cache is empty" : "Empty";
		row.append(cell);
		rows.push(row);
	}
	body.replaceChildren(...rows);
	const summary = $("[data-cache-summary]");
	if (summary) {
		summary.textContent = `${cache.size} / ${paginatorConfig.maxSize} entries · staleTime ${paginatorConfig.staleTime / 1000}s`;
	}
};
setInterval(renderCache, 250);
renderCache();

// --------------------------------------------------------
// Options and methods

$("[data-speculator-action='recreate']")?.addEventListener("click", () => {
	speculator.destroy();
	paginatorConfig = {
		maxSize: Math.max(1, Number(maxSizeInput?.value) || 3),
		staleTime: Math.max(0, Number(staleTimeInput?.value) || 0),
	};
	speculator = createPaginator();
	destroyed = false;
	speculatorLog.info("Destroyed the old Speculator and created a new one", {
		...paginatorConfig,
		optimistic: optimisticInput?.checked,
	});
});

const methods: Record<string, () => void | Promise<void>> = {
	"prefetch-3": async () => {
		const button = pageButton(3);
		if (!button) return;
		intents.set("3", { kind: "prefetch()", at: performance.now() });
		speculatorLog.info("prefetch(page 3)");
		const result = await speculator.prefetch(button);
		speculatorLog.success(
			"prefetch(page 3) resolved",
			result.data ?? result.error,
		);
	},
	"prefetch-all": async () => {
		for (const button of pageButtons) {
			const key = button.dataset.page;
			if (key)
				intents.set(key, { kind: "prefetchAll()", at: performance.now() });
		}
		speculatorLog.info("prefetchAll(every page)");
		const results = await speculator.prefetchAll(pageButtons);
		speculatorLog.success(
			`prefetchAll resolved ${results.length} results`,
			results.map((result) => result.data?.page ?? result.error?.message),
		);
	},
	"clear-all": () => {
		speculator.clearCache();
		speculatorLog.info("clearCache()");
	},
	"clear-3": () => {
		const button = pageButton(3);
		if (button) speculator.clearCache(button);
		speculatorLog.info("clearCache(page 3)");
	},
	refresh: () => {
		speculator.refresh();
		destroyed = false;
		speculatorLog.info("refresh()");
	},
	destroy: () => {
		speculator.destroy();
		destroyed = true;
		speculatorLog.info("destroy()");
	},
};

for (const button of $$<HTMLButtonElement>("[data-speculator-action]")) {
	const method = methods[button.dataset.speculatorAction ?? ""];
	if (method) button.addEventListener("click", () => void method());
}

// --------------------------------------------------------
// Hover intent with the default hoverDelay

const hoverLog = createLogger("hover intent");
const hoverButtons = $$<HTMLButtonElement>("[data-hover-page]");
const hoverStarted = new Map<string, number>();
const hoverFetched = new Set<string>();
for (const button of hoverButtons) {
	button.addEventListener("mouseenter", () => {
		const key = button.dataset.hoverPage;
		if (key) hoverStarted.set(key, performance.now());
	});
	button.addEventListener("mouseleave", () => {
		const key = button.dataset.hoverPage;
		const started = key ? hoverStarted.get(key) : undefined;
		if (!key || started === undefined || hoverFetched.has(key)) return;
		const stayed = Math.round(performance.now() - started);
		hoverLog.info(
			stayed < 200
				? `Left page ${key} after ${stayed}ms, before the delay, so it isn't fetched`
				: `Left page ${key} after ${stayed}ms`,
		);
	});
}

const hoverSpeculator = new Speculator<PageData, PageError>({
	elements: hoverButtons,
	getCacheKey: (element) => element.getAttribute("data-hover-page"),
	fetch: async (element) => {
		const key = element.getAttribute("data-hover-page");
		const started = key ? hoverStarted.get(key) : undefined;
		if (key) hoverFetched.add(key);
		hoverLog.info(
			started === undefined
				? `fetch() called for page ${key}`
				: `fetch() called for page ${key}, ${Math.round(performance.now() - started)}ms after the pointer arrived`,
		);
		return {
			data: { page: Number(key), fetchedAt: timeNow(), items: [] },
			error: undefined,
		};
	},
});

$("[data-hover-reset]")?.addEventListener("click", () => {
	hoverSpeculator.clearCache();
	hoverStarted.clear();
	hoverFetched.clear();
	hoverLog.info("Cleared the cache, so the next hover fetches again");
});

// --------------------------------------------------------
// Triggers with nested markup

const nestedLog = createLogger("nested markup");
const nestedButtons = $$<HTMLButtonElement>("[data-nested-page]");
new Speculator<PageData, PageError>({
	elements: nestedButtons,
	getCacheKey: (element) => {
		const key = element.getAttribute("data-nested-page");
		nestedLog.info(
			`getCacheKey received ${formatData(element)}, returned ${key === null ? "null" : `"${key}"`}`,
		);
		return key;
	},
	fetch: createFetcher("data-nested-page", () => 150, nestedLog, false),
	onClick: (_event, result) => {
		if (result.error) nestedLog.warn("onClick received an error", result.error);
		else nestedLog.success(`onClick received page ${result.data.page}`);
	},
});
