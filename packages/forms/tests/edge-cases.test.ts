import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";
import { files } from "../src/files.js";
import forms from "../src/index.js";
import {
	$,
	check,
	contactForm,
	file,
	mockFetch,
	pick,
	requestOf,
	settle,
	submit,
	type,
} from "./utils.js";

const fill = () => {
	type("#name", "Ada");
	type("#email", "ada@example.com");
};

/** A captcha slot whose token arrives when `release` is called */
const manualCaptcha = (slot: HTMLElement) => {
	let release = () => {};
	slot.addEventListener("captcha:token", (event) => {
		(event as CustomEvent<(wait: Promise<unknown>) => void>).detail(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
	});
	return () => release();
};

describe("sends", () => {
	it("cancels a send when the form is reset, so the next one starts cleanly", async () => {
		let calls = 0;
		const fetch = mockFetch(() => {
			calls++;
			return calls === 1 ? new Promise<Response>(() => {}) : Response.json({});
		});
		document.body.innerHTML = contactForm();
		forms.init();
		fill();
		submit();
		await settle();
		forms.get("contact")?.reset();
		expect($("#send").hasAttribute("aria-disabled")).toBe(false);
		expect((requestOf(fetch).signal as AbortSignal).aborted).toBe(true);

		fill();
		submit();
		await settle();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect($("form").getAttribute("data-form--state")).toBe("success");
		expect($("#send").hasAttribute("aria-disabled")).toBe(false);
	});

	it("leaves the form to a submit listener that calls preventDefault", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		forms.init();
		$("form").addEventListener("submit", (event) => event.preventDefault());
		submit();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
		expect($('[data-form--error="name"]').hidden).toBe(true);
	});

	it("doesn't send when a form-submit listener destroys the form", async () => {
		const send = vi.fn(async () => ({ ok: true }));
		document.body.innerHTML = contactForm();
		forms.init({ send });
		$("form").addEventListener("form-submit", () =>
			forms.get("contact")?.destroy(),
		);
		fill();
		expect(await forms.get("contact")?.submit()).toBeNull();
		expect(send).not.toHaveBeenCalled();
	});

	it("checks the fields again after waiting for a captcha", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha id="captcha"></div>`,
		});
		forms.init();
		const release = manualCaptcha($("#captcha"));
		fill();
		submit();
		await settle();
		type("#email", "");
		release();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
		expect($('[data-form--error="email"]').hidden).toBe(false);
		expect($("form").getAttribute("data-form--state")).toBe("idle");
	});

	it("submits natively once after a captcha, then resets its token", async () => {
		const native = vi
			.spyOn(HTMLFormElement.prototype, "submit")
			.mockImplementation(function (this: HTMLFormElement) {
				expect(new FormData(this).get("intent")).toBe("save");
			});
		document.body.innerHTML = contactForm({
			attributes: 'data-form--submit="native"',
			extra: `<div data-form--captcha id="captcha"></div>
				<button id="save" name="intent" value="save">Save</button>`,
		});
		forms.init();
		const release = manualCaptcha($("#captcha"));
		const reset = vi.fn();
		$("#captcha").addEventListener("captcha:reset", reset);
		const submits = vi.fn();
		$("form").addEventListener("submit", submits);
		fill();
		$("#save").click();
		await settle();
		release();
		await settle();
		expect(native).toHaveBeenCalledOnce();
		expect(submits).toHaveBeenCalledOnce();
		expect(reset).toHaveBeenCalledOnce();
		expect($('[name="intent"]')).toBe($("#save"));
	});

	it("treats a 2xx response whose body fails to download as a failed send", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mockFetch(
			() =>
				new Response(
					new ReadableStream({
						start: (controller) => controller.error(new Error("Lost")),
					}),
				),
		);
		document.body.innerHTML = contactForm();
		forms.init();
		fill();
		submit();
		await settle();
		expect($("form").getAttribute("data-form--state")).toBe("error");
		expect($<HTMLInputElement>("#name").value).toBe("Ada");
	});

	it("reads errors for fields named like object properties", async () => {
		mockFetch(() =>
			Response.json(
				{ errors: { email: "Try again", constructor: "Invalid" } },
				{ status: 422 },
			),
		);
		document.body.innerHTML = contactForm();
		forms.init();
		fill();
		submit();
		await settle();
		expect($('[data-form--error="email"]').textContent).toBe("Try again");
		expect($("[data-form--status]").textContent).toContain("Invalid");
	});

	it("sends line breaks as CRLF, as browsers do", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<textarea name="message" id="message"></textarea>`,
		});
		forms.init();
		fill();
		type("#message", "a\nb");
		submit();
		await settle();
		expect(await requestOf(fetch).text()).toContain("message=a%0D%0Ab");
	});

	it("fills an empty sent element with each new message", async () => {
		let count = 0;
		mockFetch(() => Response.json({ message: `Sent ${++count}` }));
		document.body.innerHTML = contactForm().replace(
			"Thanks, we'll be in touch.",
			"",
		);
		forms.init();
		for (const expected of ["Sent 1", "Sent 2"]) {
			forms.get("contact")?.reset();
			fill();
			submit();
			await settle();
			expect($("[data-form--sent]").textContent).toBe(expected);
		}
	});
});

describe("checks", () => {
	it("checks unnamed controls, such as an agreement that isn't sent", () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<input type="checkbox" id="terms" required><label for="terms">I agree</label>
				<p data-form--error="terms"></p>`,
		});
		forms.init();
		fill();
		submit();
		expect(fetch).not.toHaveBeenCalled();
		expect($('[data-form--error="terms"]').hidden).toBe(false);
		expect(document.activeElement).toBe($("#terms"));
	});

	it("keeps a custom validity the page set itself", () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		forms.init();
		fill();
		$<HTMLInputElement>("#email").setCustomValidity("Already taken");
		submit();
		expect(fetch).not.toHaveBeenCalled();
		expect($('[data-form--error="email"]').textContent).toBe("Already taken");
		forms.destroy();
		expect($<HTMLInputElement>("#email").validationMessage).toBe(
			"Already taken",
		);
	});

	it("runs rules on selects", () => {
		document.body.innerHTML = contactForm({
			extra: `<select name="plan" id="plan" data-form--rule="deny"><option value="pro" selected>Pro</option></select>
				<p data-form--error="plan"></p>`,
		});
		forms.init({ rules: { deny: () => "Not available" } });
		fill();
		submit();
		expect($('[data-form--error="plan"]').textContent).toBe("Not available");
	});

	it("moves focus past controls that can't take it", () => {
		// Browsers also skip controls in a disabled fieldset, which happy-dom doesn't model.
		document.body.innerHTML = contactForm({
			extra: `<div inert><input name="code" id="code-a" required></div>
				<input name="code" id="code-b" required><p data-form--error="code"></p>`,
		});
		forms.init();
		fill();
		submit();
		expect(document.activeElement).toBe($("#code-b"));
	});

	it("updates the count of answers to fix as they are fixed", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		submit();
		const status = $("[data-form--status]");
		expect(status.textContent).toContain("2 answers");
		type("#name", "Ada");
		expect(status.textContent).toContain("1 answer");
		type("#email", "ada@example.com");
		expect(status.textContent).toBe("");
	});

	it("drops error ids from aria-describedby once their element is replaced", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		submit();
		const old = $('[data-form--error="email"]');
		const replacement = document.createElement("p");
		replacement.setAttribute("data-form--error", "email");
		replacement.id = "email-error-2";
		old.replaceWith(replacement);
		forms.refresh();
		expect($("#email").getAttribute("aria-describedby")).toBe("email-error-2");
		onTestFinished(() => forms.destroy());
	});
});

describe("second review", () => {
	it("leaves a form to a submit listener on the window that calls preventDefault", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		const cancel = (event: Event) => event.preventDefault();
		window.addEventListener("submit", cancel);
		onTestFinished(() => window.removeEventListener("submit", cancel));
		forms.init();
		fill();
		submit();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("keeps a send started from a form-submit listener that cancels the first", async () => {
		const fetch = mockFetch(() => new Promise<Response>(() => {}));
		document.body.innerHTML = contactForm();
		forms.init();
		let restarted = false;
		$("form").addEventListener("form-submit", (event) => {
			if (restarted) return;
			restarted = true;
			event.preventDefault();
			forms.get("contact")?.reset();
			fill();
			void forms.get("contact")?.submit();
		});
		fill();
		submit();
		await settle();
		expect(fetch).toHaveBeenCalledOnce();
		expect($("form").getAttribute("data-form--state")).toBe("submitting");
	});

	it("checks fields named like object properties", () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<input name="__proto__" id="proto" required><p data-form--error="__proto__"></p>`,
		});
		forms.init();
		fill();
		submit();
		expect(fetch).not.toHaveBeenCalled();
		expect(Object.keys(forms.get("contact")?.state.errors ?? {})).toEqual([
			"__proto__",
		]);
		expect($('[data-form--error="__proto__"]').hidden).toBe(false);
	});

	it("checks an unnamed control whose id ends in an index", () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<input type="checkbox" id="terms.0" required><p data-form--error="terms.0"></p>`,
		});
		forms.init();
		fill();
		submit();
		expect(fetch).not.toHaveBeenCalled();
		expect($('[data-form--error="terms.0"]').hidden).toBe(false);
	});

	it("compares data-form--match with the chosen radio", () => {
		document.body.innerHTML = contactForm({
			extra: `<input type="radio" name="size" value="a" id="size-a">
				<input type="radio" name="size" value="b" id="size-b">
				<input name="again" id="again" data-form--match="size"><p data-form--error="again"></p>`,
		});
		forms.init();
		fill();
		check("#size-b");
		type("#again", "b");
		submit();
		expect(forms.get("contact")?.state.errors).toEqual({});
	});

	it("keeps an id the markup already had in aria-describedby", () => {
		document.body.innerHTML = contactForm()
			.replace(
				'<p data-form--error="email"></p>',
				'<p data-form--error="email" id="email-error"></p>',
			)
			.replace(
				'type="email" required',
				'type="email" required aria-describedby="email-error"',
			);
		forms.init();
		submit();
		type("#email", "ada@example.com");
		expect($("#email").getAttribute("aria-describedby")).toBe("email-error");
	});

	it("gives subscribers and state readers copies they can't change the form through", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		submit();
		const form = forms.get("contact");
		const errors = form?.state.errors.email;
		if (errors) errors[0] = "Changed";
		expect(form?.state.errors.email?.[0]).not.toBe("Changed");
	});

	it("keeps a rejected file's error while it is still picked", () => {
		document.body.innerHTML = `
			<form data-form method="post" action="/upload">
				<input type="file" id="docs" name="docs" multiple accept=".pdf">
				<ul data-form--files="docs"><template><li>{name}</li></template></ul>
				<p data-form--error="docs"></p>
				<button>Send</button>
			</form>`;
		forms.init({ extensions: [files] });
		pick("#docs", [file("wrong.txt")]);
		submit();
		expect($('[data-form--error="docs"]').hidden).toBe(false);
		pick("#docs", [file("right.pdf")]);
		expect($<HTMLInputElement>("#docs").files).toHaveLength(2);
		expect($('[data-form--error="docs"]').textContent).toBe(
			"wrong.txt is not an accepted file type",
		);
	});

	it("stops waiting when a captcha listener resets the form while being asked", async () => {
		mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha id="captcha"></div>`,
		});
		forms.init();
		$("#captcha").addEventListener("captcha:token", (event) => {
			forms.get("contact")?.reset();
			(event as CustomEvent<(wait: Promise<unknown>) => void>).detail(
				new Promise(() => {}),
			);
		});
		fill();
		const result = forms.get("contact")?.submit();
		expect(await result).toBeNull();
	});
});

describe("final review", () => {
	it("leaves a form to a window submit listener added after init", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		forms.init();
		const cancel = (event: Event) => event.preventDefault();
		window.addEventListener("submit", cancel);
		onTestFinished(() => window.removeEventListener("submit", cancel));
		fill();
		submit();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("clears the library's custom validity when the form is reset", () => {
		document.body.innerHTML = contactForm({
			extra: `<textarea id="bio" name="bio" data-form--maxlength="3">Hi</textarea>
				<p data-form--error="bio"></p>`,
		});
		forms.init();
		fill();
		type("#bio", "Hello");
		submit();
		expect($<HTMLTextAreaElement>("#bio").checkValidity()).toBe(false);
		forms.get("contact")?.reset();
		expect($<HTMLTextAreaElement>("#bio").checkValidity()).toBe(true);
	});

	it("clears aria-invalid from a control that moved to another field", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		submit();
		$("#email").setAttribute("name", "contact");
		forms.refresh();
		forms.get("contact")?.clearErrors("email");
		expect($("#email").hasAttribute("aria-invalid")).toBe(false);
	});

	it("stops asking widgets for tokens once one resets the form", async () => {
		mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha id="first"></div><div data-form--captcha id="second"></div>`,
		});
		forms.init();
		$("#first").addEventListener("captcha:token", (event) => {
			forms.get("contact")?.reset();
			(event as CustomEvent<(wait: Promise<unknown>) => void>).detail(
				Promise.reject(new Error("Failed")),
			);
		});
		const second = vi.fn();
		$("#second").addEventListener("captcha:token", second);
		fill();
		expect(await forms.get("contact")?.submit()).toBeNull();
		expect(second).not.toHaveBeenCalled();
	});
});
