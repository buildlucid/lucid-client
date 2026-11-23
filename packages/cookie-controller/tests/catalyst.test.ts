import Catalyst from "@lucidclient/catalyst";
import { bind, events, model } from "@lucidclient/catalyst/reactions";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { consentStore } from "../src/catalyst.js";
import cookieController from "../src/index.js";
import S from "../src/state.js";
import { click, detailsMarkup, settle } from "./utils.js";

const start = () =>
	Catalyst.start({
		stores: { consent: consentStore },
		reactions: [bind, events, model],
	});

const markup = `${detailsMarkup}
	<div data-store="consent">
		<p id="placeholder" data-bind--hidden="$granted.marketing">Allow marketing cookies to watch</p>
		<p id="embed" data-bind--hidden="$denied.marketing">Embed</p>
		<p id="decided" data-bind--data-decided="$decided"></p>
		<input id="toggle" type="checkbox" data-model="$granted.marketing" />
		<button id="accept" data-events--click="@acceptAll">Accept all</button>
		<button id="reject" data-events--click="@rejectAll">Reject all</button>
	</div>
`;

const isHidden = (selector: string) =>
	document.querySelector(selector)?.hasAttribute("hidden");

afterEach(async () => {
	await settle();
	Catalyst.destroy();
	vi.restoreAllMocks();
});

describe("consentStore", () => {
	it("binds markup to granted, denied and decided", async () => {
		document.body.innerHTML = markup;
		cookieController.init();
		start();
		await settle();

		expect(isHidden("#placeholder")).toBe(false);
		expect(isHidden("#embed")).toBe(true);
		expect(
			document.querySelector("#decided")?.getAttribute("data-decided"),
		).toBe("false");

		cookieController.acceptAll();
		await settle();

		expect(isHidden("#placeholder")).toBe(true);
		expect(isHidden("#embed")).toBe(false);
		expect(
			document.querySelector("#decided")?.getAttribute("data-decided"),
		).toBe("true");
	});

	it("picks up the categories when Catalyst starts before init", async () => {
		document.body.innerHTML = markup;
		start();
		await settle();
		// Before init, unknown categories read as undefined, so both show.
		expect(isHidden("#embed")).toBe(false);

		cookieController.init();
		await settle();

		expect(isHidden("#placeholder")).toBe(false);
		expect(isHidden("#embed")).toBe(true);
	});

	it("calls the library's methods from its actions", async () => {
		document.body.innerHTML = markup;
		cookieController.init();
		start();

		click("#accept");
		await settle();
		expect(cookieController.getConsent("marketing")).toBe(true);
		expect(isHidden("#embed")).toBe(false);

		click("#reject");
		await settle();
		expect(cookieController.getConsent("marketing")).toBe(false);
		expect(isHidden("#embed")).toBe(true);
	});

	it("saves a category straight away from data-model", async () => {
		document.body.innerHTML = markup;
		const onConsentChange = vi.fn();
		cookieController.init({ onConsentChange });
		start();
		await settle();
		const toggle = document.querySelector<HTMLInputElement>("#toggle");
		expect(toggle?.checked).toBe(false);

		toggle?.click();
		await settle();

		expect(cookieController.getConsent("marketing")).toBe(true);
		expect(cookieController.getConsent("analytics")).toBe(false);
		expect(onConsentChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ type: "update" }),
		);
		expect(document.cookie).toContain("CookieController=");
		expect(isHidden("#embed")).toBe(false);
		// The details checkbox follows the saved choice too.
		expect(
			document.querySelector<HTMLInputElement>(
				'[data-cookie--details] [data-cookie--category="marketing"]',
			)?.checked,
		).toBe(true);
	});

	it("resets a model the library refuses, such as essential", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `${detailsMarkup}
			<div data-store="consent">
				<input id="essential" type="checkbox" data-model="$granted.essential" />
			</div>`;
		cookieController.init();
		start();
		await settle();
		const essential = document.querySelector<HTMLInputElement>("#essential");
		expect(essential?.checked).toBe(true);

		essential?.click();
		await settle();

		expect(essential?.checked).toBe(true);
		expect(cookieController.getConsent("essential")).toBe(true);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('"essential" category is always consented'),
		);
	});

	it("gives each scope its own store and stops listening when destroyed", async () => {
		document.body.innerHTML = `${detailsMarkup}
			<div data-store="banner"><p id="a" data-bind--hidden="$granted.analytics"></p></div>
			<div data-store="footer"><p id="b" data-bind--hidden="$granted.analytics"></p></div>`;
		cookieController.init();
		Catalyst.start({
			stores: { banner: consentStore, footer: consentStore },
			reactions: [bind],
		});
		expect(S.listeners.size).toBe(2);

		cookieController.updateConsent({ analytics: true });
		await settle();
		expect(isHidden("#a")).toBe(true);
		expect(isHidden("#b")).toBe(true);

		Catalyst.destroy();
		expect(S.listeners.size).toBe(0);
	});
});
