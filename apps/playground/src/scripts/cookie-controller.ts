import cookieController, {
	type ConsentChange,
} from "@lucidclient/cookie-controller";
import { createLogger, formatData } from "../lib/log";

const log = createLogger("consent");
const gateLog = createLogger("gated");

const COOKIE_NAME = "CookieController";
const CATEGORIES = ["essential", "analytics", "marketing"] as const;
const params = new URLSearchParams(window.location.search);
const policyVersion = params.get("policy") ?? "1.0.2";

let lastChange: ConsentChange | null = null;

// --------------------------------------------------------
// Status panel

const readCookie = () => {
	const entry = document.cookie
		.split("; ")
		.find((part) => part.startsWith(`${COOKIE_NAME}=`));
	if (!entry) return null;
	const raw = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return raw;
	}
};

const setText = (selector: string, text: string) => {
	for (const element of document.querySelectorAll(selector)) {
		element.textContent = text;
	}
};

const renderStatus = () => {
	const consent = cookieController.getConsent();
	for (const category of CATEGORIES) {
		const granted = consent[category] === true;
		for (const pill of document.querySelectorAll<HTMLElement>(
			`[data-consent-pill="${category}"]`,
		)) {
			pill.dataset.granted = String(granted);
			pill.textContent = granted ? "Granted" : "Denied";
		}
	}
	const cookie = readCookie();
	setText("[data-consent-policy]", policyVersion);
	setText("[data-consent-type]", lastChange?.type ?? "—");
	setText("[data-consent-uuid]", lastChange?.uuid || "not assigned yet");
	setText(
		"[data-consent-cookie]",
		cookie === null ? "No preference cookie" : formatData(cookie),
	);
};

// --------------------------------------------------------
// Gated scripts report back through this global.

declare global {
	interface Window {
		cookieGate?: (name: string) => void;
	}
}

window.cookieGate = (name) => {
	for (const status of document.querySelectorAll<HTMLElement>(
		`[data-gate="${name}"]`,
	)) {
		status.dataset.ran = "true";
		status.textContent = "Ran";
	}
	gateLog.success(`The "${name}" script ran`);
};

// --------------------------------------------------------
// Init

const init = () =>
	cookieController.init({
		cookies: {
			essential: ["session"],
			analytics: ["_ga", "_gid"],
			marketing: ["_fbp", "mkto"],
		},
		policyVersion,
		onConsentChange: (data) => {
			lastChange = data;
			log.info(`onConsentChange: ${data.type}`, data);
			renderStatus();
		},
		onPolicyVersionChange: (oldVersion, newVersion) => {
			log.warn(`onPolicyVersionChange: ${oldVersion} → ${newVersion}`);
		},
		storage: {
			path: "/",
			sameSite: "Lax",
			secure: window.location.protocol === "https:",
		},
	});

log.info("getConsent() before init reads the cookie directly", {
	withoutVersion: cookieController.getConsent(),
	withVersion: cookieController.getConsent({ policyVersion }),
});
init();
renderStatus();

// --------------------------------------------------------
// Method buttons

const methods: Record<string, () => unknown> = {
	acceptAll: () => cookieController.acceptAll(),
	rejectAll: () => cookieController.rejectAll(),
	grantMarketing: () => cookieController.updateConsent({ marketing: true }),
	withdrawAnalytics: () => cookieController.updateConsent({ analytics: false }),
	openDetails: () => cookieController.openDetails(),
	getConsent: () => {
		log.info("getConsent()", cookieController.getConsent());
		log.info(
			'getConsent("marketing")',
			cookieController.getConsent("marketing"),
		);
		log.info('getConsent("unknown")', cookieController.getConsent("unknown"));
	},
	refresh: () => {
		cookieController.refresh();
		log.info("refresh() re-read the markup");
	},
	destroy: () => {
		cookieController.destroy();
		log.warn("destroy() removed the listeners. Action buttons do nothing now.");
	},
	init: () => {
		init();
		log.info("init() ran again");
	},
	reset: () => {
		document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
		window.location.reload();
	},
};

for (const button of document.querySelectorAll<HTMLElement>("[data-call]")) {
	button.addEventListener("click", () => {
		const name = button.dataset.call ?? "";
		const method = methods[name];
		if (!method) return;
		method();
		// Methods that change consent call onConsentChange, which re-renders,
		// but refresh, destroy and opening the dialog don't.
		renderStatus();
	});
}

// --------------------------------------------------------
// Dynamic markup: a gated image added after init

document
	.querySelector("[data-add-gated-image]")
	?.addEventListener("click", () => {
		const list = document.querySelector("[data-dynamic-media]");
		if (!list) return;
		const figure = document.createElement("figure");
		figure.className = "relative overflow-hidden rounded-md border border-line";
		figure.innerHTML = `
			<img data-cookie-category="marketing" data-src="/cookie/pixel.svg?added=${Date.now()}" alt="Added after init" width="320" height="120" class="peer block h-24 w-full object-cover" />
			<figcaption class="absolute inset-0 grid place-items-center bg-raised text-xs text-subtle peer-data-[cookie-activated]:hidden">Waiting for marketing consent and refresh()</figcaption>`;
		list.append(figure);
		log.info(
			"Added a marketing image after init. Call refresh() to pick it up.",
		);
	});
