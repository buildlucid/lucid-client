import { describe, expect, it } from "vite-plus/test";
import cookieController from "../src/index.js";
import { click, detailsMarkup } from "./utils.js";

describe("attributes", () => {
	it("marks the banner and details elements with their open state", () => {
		document.body.innerHTML = `${detailsMarkup}<div data-cookie--banner></div>`;
		cookieController.init();

		const banner = document.querySelector("[data-cookie--banner]");
		const details = document.querySelector("[data-cookie--details]");
		expect(banner?.getAttribute("data-cookie--banner")).toBe("true");
		expect(details?.getAttribute("data-cookie--details")).toBe("false");

		cookieController.openDetails();
		expect(banner?.getAttribute("data-cookie--banner")).toBe("false");
		expect(details?.getAttribute("data-cookie--details")).toBe("true");
	});

	it("runs the action of a data-cookie--action element", () => {
		document.body.innerHTML = `${detailsMarkup}<button id="accept" data-cookie--action="accept">Accept</button>`;
		cookieController.init();

		click("#accept");

		expect(cookieController.getConsent()).toEqual({
			analytics: true,
			marketing: true,
			essential: true,
		});
	});

	it("updates one category from an action with data-cookie--category", () => {
		document.body.innerHTML = `${detailsMarkup}
			<button id="allow" data-cookie--action="accept" data-cookie--category="marketing">Allow</button>`;
		cookieController.init();

		click("#allow");

		expect(cookieController.getConsent("marketing")).toBe(true);
		expect(cookieController.getConsent("analytics")).toBe(false);
	});

	it("shows an essential checkbox checked and disabled", () => {
		document.body.innerHTML = detailsMarkup;
		cookieController.init();

		const essential = document.querySelector<HTMLInputElement>(
			'[data-cookie--category="essential"]',
		);
		expect(essential?.checked).toBe(true);
		expect(essential?.disabled).toBe(true);
	});

	it("loads data-cookie--src and data-cookie--srcset once the category is consented", () => {
		document.body.innerHTML = `${detailsMarkup}
			<img data-cookie--category="marketing" data-cookie--src="/pixel.gif" data-cookie--srcset="/pixel-2x.gif 2x" alt="" />`;
		cookieController.init();
		const image = document.querySelector("img");
		expect(image?.hasAttribute("src")).toBe(false);

		cookieController.updateConsent({ marketing: true });

		expect(image?.getAttribute("src")).toBe("/pixel.gif");
		expect(image?.getAttribute("srcset")).toBe("/pixel-2x.gif 2x");
		expect(image?.hasAttribute("data-cookie--src")).toBe(false);
		expect(image?.hasAttribute("data-cookie--activated")).toBe(true);
	});

	it("leaves plain data-src alone, so it doesn't clash with lazy loading libraries", () => {
		document.body.innerHTML = `${detailsMarkup}
			<img data-cookie--category="marketing" data-src="/lazy.gif" alt="" />`;
		cookieController.init();

		cookieController.updateConsent({ marketing: true });

		const image = document.querySelector("img");
		expect(image?.getAttribute("data-src")).toBe("/lazy.gif");
		expect(image?.hasAttribute("src")).toBe(false);
	});

	it("runs a gated script with the type from data-cookie--type", () => {
		document.body.innerHTML = `${detailsMarkup}
			<script type="text/plain" data-cookie--type="module" data-cookie--category="analytics"></script>`;
		cookieController.init();

		cookieController.updateConsent({ analytics: true });

		const script = document.querySelector("script");
		expect(script?.type).toBe("module");
		expect(script?.hasAttribute("data-cookie--type")).toBe(false);
		expect(script?.hasAttribute("data-cookie--activated")).toBe(true);
	});

	it("no longer reads the old data-cookie-* attributes", () => {
		document.body.innerHTML = `${detailsMarkup}<button id="old" data-cookie-action="accept">Accept</button>`;
		cookieController.init();

		click("#old");

		expect(cookieController.getConsent("marketing")).toBe(false);
	});
});
