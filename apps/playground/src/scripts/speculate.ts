import speculate from "@lucidclient/speculate";
import { createLogger } from "../lib/log";
import { targetLinks } from "./speculate-links";

const linksLog = createLogger("speculate");

const $ = <E extends Element = HTMLElement>(selector: string) =>
	document.querySelector<E>(selector);
const $$ = <E extends Element = HTMLElement>(selector: string) =>
	Array.from(document.querySelectorAll<E>(selector));

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
const slowConnection = /2g|3g/.test(connection?.effectiveType ?? "");
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

/** Mirrors the fallbacks Speculate uses without Speculation Rules. */
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

	const injected = $$("head [data-speculate--generated]");
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

let initialised = true;
speculate.init();
linksLog.info("speculate.init() called");

const renderLinksState = () => {
	const pill = $("[data-links-state]");
	if (!pill) return;
	pill.textContent = initialised ? "initialised" : "destroyed";
	pill.dataset.running = String(initialised);
};
renderLinksState();

for (const button of $$<HTMLButtonElement>("[data-links-action]")) {
	button.addEventListener("click", () => {
		// Both reset what Speculate has requested, so the fetch readout starts over too.
		fetched.clear();
		if (button.dataset.linksAction === "destroy") {
			speculate.destroy();
			initialised = false;
			linksLog.info("destroy() removed the injected rules and links");
		} else {
			speculate.init();
			initialised = true;
			linksLog.info("speculate.init() called again");
		}
		renderLinksState();
		renderInjected();
	});
}

// --------------------------------------------------------
// Links added after init

const lateTemplate = $<HTMLTemplateElement>("[data-late-template]");
const lateSlot = $("[data-late-slot]");

$("[data-late-add]")?.addEventListener("click", () => {
	if (!lateTemplate || !lateSlot || lateSlot.childElementCount > 0) return;
	lateSlot.append(lateTemplate.content.cloneNode(true));
	linksLog.info("Added a link after init");
});

$("[data-late-refresh]")?.addEventListener("click", () => {
	speculate.refresh();
	linksLog.info("speculate.refresh() called");
});
