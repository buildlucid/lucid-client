import { createLogger } from "../lib/log";

const log = createLogger("target");

type NavigationEntry = PerformanceNavigationTiming & {
	activationStart?: number;
	deliveryType?: string;
};
type PrerenderDocument = Document & { prerendering?: boolean };

const doc = document as PrerenderDocument;
const entry = performance.getEntriesByType("navigation")[0] as
	| NavigationEntry
	| undefined;

const describe = () => {
	const activationStart = entry?.activationStart ?? 0;
	const deliveryType = entry?.deliveryType ?? "";
	const fromCache =
		deliveryType === "cache" ||
		(entry !== undefined &&
			entry.transferSize === 0 &&
			entry.decodedBodySize > 0);

	if (doc.prerendering) {
		return {
			method: "prerender",
			label: "Prerendering",
			detail: "Not shown yet; it activates when the link is opened.",
		};
	}
	if (activationStart > 0) {
		return {
			method: "prerender",
			label: "Prerendered",
			detail: `Activated ${Math.round(activationStart)}ms after the prerender started.`,
		};
	}
	if (deliveryType === "navigational-prefetch") {
		return {
			method: "prefetch",
			label: "Prefetched by Speculation Rules",
			detail: "The document came from the speculation prefetch cache.",
		};
	}
	if (fromCache) {
		return {
			method: "cache",
			label: "HTTP cache",
			detail:
				'Served from the HTTP cache, as the <link rel="prefetch"> and fetch fallbacks are.',
		};
	}
	return {
		method: "network",
		label: "Network",
		detail: "Loaded normally, without speculation.",
	};
};

const render = () => {
	const result = describe();
	const badge = document.querySelector<HTMLElement>("[data-load-method]");
	if (badge) {
		badge.textContent = result.label;
		badge.dataset.method = result.method;
	}
	const detail = document.querySelector("[data-load-detail]");
	if (detail) detail.textContent = result.detail;
	const values = {
		prerendering: doc.prerendering ?? false,
		activationStart: entry?.activationStart ?? null,
		deliveryType: entry?.deliveryType ?? null,
		transferSize: entry?.transferSize ?? null,
		decodedBodySize: entry?.decodedBodySize ?? null,
		navigationType: entry?.type ?? null,
	};
	const readout = document.querySelector("[data-load-values]");
	if (readout) readout.textContent = JSON.stringify(values, null, 2);
	return { result, values };
};

const { result, values } = render();
log.info(`${result.label}: ${result.detail}`, values);

if (doc.prerendering) {
	document.addEventListener(
		"prerenderingchange",
		() => {
			const activated = render();
			log.success(`Activated: ${activated.result.label}`, activated.values);
		},
		{ once: true },
	);
}
