import { describe, expect, it, vi } from "vite-plus/test";
import cookieController from "../src/index.js";
import { click } from "./utils.js";

const $ = <E extends HTMLElement = HTMLElement>(selector: string) => {
	const element = document.querySelector<E>(selector);
	if (!element) throw new Error(`No element matches ${selector}`);
	return element;
};

const press = (element: Element, key: string) =>
	element.dispatchEvent(
		new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
	);

const dialog = `
	<dialog data-cookie--details hidden>
		<label><input type="checkbox" data-cookie--category="analytics" /> Analytics</label>
		<label><input type="checkbox" data-cookie--category="marketing" /> Marketing</label>
		<button id="close" data-cookie--action="dismiss">Close</button>
		<button id="save" data-cookie--action="save">Save</button>
	</dialog>
`;

const bannerMarkup = `
	<div data-cookie--banner hidden>
		<button id="accept" data-cookie--action="accept">Accept</button>
		<button id="settings" data-cookie--action="details">Settings</button>
	</div>
`;

describe("accessibility", () => {
	it("makes the banner a named region rather than an alert", () => {
		document.body.innerHTML = dialog + bannerMarkup;
		cookieController.init();
		const banner = $("[data-cookie--banner]");
		expect(banner.getAttribute("role")).toBe("region");
		expect(banner.getAttribute("aria-label")).toBe("Cookie consent");
		expect(banner.hasAttribute("aria-live")).toBe(false);
		expect(banner.hasAttribute("aria-hidden")).toBe(false);
	});

	it("keeps the markup's own roles and names", () => {
		document.body.innerHTML = `${dialog.replace("<dialog data-cookie--details", '<dialog data-cookie--details aria-labelledby="title"')}<h2 id="title">Settings</h2>
			<aside data-cookie--banner aria-label="Cookies on Example"></aside>`;
		cookieController.init();
		expect($("aside").hasAttribute("role")).toBe(false);
		expect($("aside").getAttribute("aria-label")).toBe("Cookies on Example");
		expect($("dialog").hasAttribute("aria-label")).toBe(false);
	});

	it("names a <dialog> without making it modal itself, and leaves its triggers alone", () => {
		document.body.innerHTML = dialog + bannerMarkup;
		cookieController.init();
		const details = $("dialog");
		expect(details.hasAttribute("role")).toBe(false);
		expect(details.hasAttribute("aria-modal")).toBe(false);
		expect(details.getAttribute("aria-label")).toBe("Cookie settings");
		const trigger = $("#settings");
		expect(trigger.getAttribute("aria-controls")).toBe(details.id);
		expect(trigger.hasAttribute("aria-expanded")).toBe(false);
		expect(trigger.hasAttribute("aria-haspopup")).toBe(false);
	});

	it("translates its names with the messages passed to init", () => {
		document.body.innerHTML = dialog + bannerMarkup;
		cookieController.init({
			messages: { banner: "Consentement aux cookies", details: "Paramètres" },
		});
		expect($("[data-cookie--banner]").getAttribute("aria-label")).toBe(
			"Consentement aux cookies",
		);
		expect($("dialog").getAttribute("aria-label")).toBe("Paramètres");
	});

	it("removes what it added on destroy", () => {
		document.body.innerHTML = `${dialog}${bannerMarkup}<p data-cookie--status>Ready</p>`;
		cookieController.init();
		click("#accept");
		cookieController.destroy();
		for (const element of document.querySelectorAll(
			"[data-cookie--banner], dialog, [data-cookie--status]",
		)) {
			for (const name of [
				"role",
				"aria-label",
				"id",
				"tabindex",
				"aria-atomic",
			])
				expect(element.hasAttribute(name)).toBe(false);
		}
		expect($("#settings").hasAttribute("aria-controls")).toBe(false);
		expect($("[data-cookie--status]").textContent).toBe("Ready");
	});

	it("warns about a details element that isn't a dialog and an unlabelled checkbox", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `<div data-cookie--details><input type="checkbox" data-cookie--category="analytics" /></div>`;
		cookieController.init();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("isn't a <dialog>"),
		);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('The "analytics" category checkbox has no label'),
		);
		warn.mockRestore();
	});
});

describe("focus", () => {
	it("gives focus back to a trigger in the banner once the details close", () => {
		document.body.innerHTML = dialog + bannerMarkup;
		cookieController.init();
		const settings = $("#settings");
		settings.focus();
		click("#settings");
		expect($("[data-cookie--banner]").hidden).toBe(true);
		click("#close");
		expect($("[data-cookie--banner]").hidden).toBe(false);
		expect(document.activeElement).toBe(settings);
	});

	it("moves focus to the status once a decision hides what held it", () => {
		document.body.innerHTML = `${dialog}${bannerMarkup}<p data-cookie--status></p>`;
		cookieController.init();
		const status = $("[data-cookie--status]");
		expect(status.getAttribute("role")).toBe("status");
		$("#accept").focus();
		click("#accept");
		expect(status.textContent).toBe("You've accepted all cookies.");
		expect(document.activeElement).toBe(status);
	});

	it("moves focus to a status that hides while it is empty, once a repeated message is back", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = `${dialog}<p data-cookie--status></p>`;
		cookieController.init();
		const status = $("[data-cookie--status]");
		// As `[data-cookie--status]:empty { display: none }` hides it
		status.checkVisibility = () => status.textContent !== "";
		cookieController.rejectAll();
		expect(document.activeElement).toBe(status);
		cookieController.rejectAll();
		// A browser takes focus from an element that stops being shown
		status.blur();
		expect(document.activeElement).toBe(document.body);
		await vi.advanceTimersByTimeAsync(100);
		expect(document.activeElement).toBe(status);
		vi.useRealTimers();
	});

	it("leaves focus on a trigger that is still showing", () => {
		document.body.innerHTML = `${dialog}<button id="footer" data-cookie--action="details">Cookie settings</button><p data-cookie--status></p>`;
		cookieController.init();
		const footer = $("#footer");
		footer.focus();
		click("#footer");
		click("#save");
		expect($("[data-cookie--status]").textContent).toBe(
			"Your cookie preferences have been saved.",
		);
		expect(document.activeElement).toBe(footer);
	});

	it("focuses a details element that isn't a dialog, and closes it with Escape", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `<div data-cookie--details hidden><button id="close" data-cookie--action="dismiss">Close</button></div>
			<button id="open" data-cookie--action="details">Cookie settings</button>`;
		cookieController.init();
		const details = $("[data-cookie--details]");
		expect(details.getAttribute("role")).toBe("dialog");
		expect(details.hasAttribute("aria-modal")).toBe(false);
		const open = $("#open");
		open.focus();
		click("#open");
		expect(document.activeElement).toBe(details);
		press($("#close"), "Escape");
		expect(details.hidden).toBe(true);
		expect(document.activeElement).toBe(open);
	});
});

describe("status messages", () => {
	it("uses the status element's own messages, then init's", () => {
		document.body.innerHTML = `${dialog}${bannerMarkup}
			<p data-cookie--status data-cookie--message-saved="Préférences enregistrées."></p>`;
		cookieController.init({ messages: { accepted: "Cookies acceptés." } });
		const status = $("[data-cookie--status]");
		click("#accept");
		expect(status.textContent).toBe("Cookies acceptés.");
		cookieController.openDetails();
		click("#save");
		expect(status.textContent).toBe("Préférences enregistrées.");
	});

	it("writes a repeated message again, so it is read again", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = `${dialog}<p data-cookie--status></p>`;
		cookieController.init();
		const status = $("[data-cookie--status]");
		cookieController.rejectAll();
		expect(status.textContent).toBe("You've rejected optional cookies.");
		cookieController.rejectAll();
		expect(status.textContent).toBe("");
		await vi.advanceTimersByTimeAsync(100);
		expect(status.textContent).toBe("You've rejected optional cookies.");
		vi.useRealTimers();
	});

	it("leaves every status on the latest decision when another follows a repeated one", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = `${dialog}<p data-cookie--status></p><p data-cookie--status></p>`;
		cookieController.init();
		const statuses = Array.from(
			document.querySelectorAll("[data-cookie--status]"),
		);
		cookieController.rejectAll();
		cookieController.rejectAll();
		cookieController.acceptAll();
		await vi.advanceTimersByTimeAsync(100);
		expect(statuses.map((status) => status.textContent)).toEqual([
			"You've accepted all cookies.",
			"You've accepted all cookies.",
		]);
		vi.useRealTimers();
	});
});
