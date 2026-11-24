import { describe, expect, it, vi } from "vite-plus/test";
import forms, { type FormSubmitDetail } from "../src/index.js";
import {
	$,
	$$,
	check,
	contactForm,
	mockFetch,
	requestOf,
	settle,
	submit,
	type,
} from "./utils.js";

const fill = () => {
	type("#name", "Ada");
	type("#email", "ada@example.com");
};

describe("setup", () => {
	it("prepares the markup", () => {
		document.body.innerHTML = contactForm({ summary: true });
		forms.init();
		const form = $("form");
		expect(form.hasAttribute("novalidate")).toBe(true);
		expect(form.hasAttribute("data-form--ready")).toBe(true);
		expect(form.getAttribute("data-form--state")).toBe("idle");
		expect($("[data-form--status]").getAttribute("role")).toBe("status");
		expect($('[data-form--error="name"]').hidden).toBe(true);
		expect($("[data-form--summary]").hidden).toBe(true);
		expect($("[data-form--sent]").hidden).toBe(true);
		expect($("[data-form--sent]").getAttribute("tabindex")).toBe("-1");
	});

	it("puts the markup back when destroyed", () => {
		document.body.innerHTML = contactForm({ summary: true });
		const original = document.body.innerHTML;
		forms.init();
		submit();
		expect(document.body.innerHTML).not.toBe(original);
		forms.destroy();
		expect(document.body.innerHTML).toBe(original);
	});

	it("links errors the server already rendered to their fields", () => {
		document.body.innerHTML = contactForm().replace(
			'<p data-form--error="email"></p>',
			'<p data-form--error="email">That email is already registered</p>',
		);
		forms.init();
		expect($("#email").getAttribute("aria-invalid")).toBe("true");
		expect(forms.get("contact")?.state.errors).toEqual({
			email: ["That email is already registered"],
		});
		type("#email", "new@example.com");
		expect($('[data-form--error="email"]').hidden).toBe(true);
	});

	it("skips data-form on elements that aren't forms", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `<div data-form></div>`;
		forms.init();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("only works on <form> elements"),
		);
	});
});

describe("validation", () => {
	it("shows errors on submit, linked to their fields, and focuses the first", () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		forms.init();
		const invalid = vi.fn();
		document.addEventListener("form-invalid", invalid);
		submit();

		const error = $('[data-form--error="name"]');
		expect(error.hidden).toBe(false);
		expect(error.textContent).not.toBe("");
		expect(error.id).not.toBe("");
		expect($("#name").getAttribute("aria-invalid")).toBe("true");
		expect($("#name").getAttribute("aria-describedby")).toBe(error.id);
		expect(
			$('[data-form--field="name"]').hasAttribute("data-form--invalid"),
		).toBe(true);
		expect($("form").hasAttribute("data-form--invalid")).toBe(true);
		expect(document.activeElement).toBe($("#name"));
		expect($("[data-form--status]").textContent).toContain(
			"problems with 2 answers",
		);
		expect(invalid).toHaveBeenCalledOnce();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("uses messages from the markup, then init, then the browser", () => {
		document.body.innerHTML = contactForm().replace(
			'name="name" required',
			'name="name" required data-form--message-required="Enter your {label}"',
		);
		forms.init({ messages: { type: "Enter an email like name@example.com" } });
		type("#email", "nope");
		submit();
		expect($('[data-form--error="name"]').textContent).toBe("Enter your Name");
		expect($('[data-form--error="email"]').textContent).toBe(
			"Enter an email like name@example.com",
		);
	});

	it("shows no errors while typing, then clears them as soon as they're fixed", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		type("#email", "nope");
		expect($('[data-form--error="email"]').hidden).toBe(true);

		submit();
		expect($('[data-form--error="email"]').hidden).toBe(false);
		type("#email", "ada@example.com");
		expect($('[data-form--error="email"]').hidden).toBe(true);
		expect($("#email").hasAttribute("aria-invalid")).toBe(false);
		expect($("#email").hasAttribute("aria-describedby")).toBe(false);
	});

	it('checks a field when it changes with data-form--validate="change"', () => {
		document.body.innerHTML = contactForm({
			attributes: 'data-form--validate="change"',
		});
		forms.init();
		const email = $<HTMLInputElement>("#email");
		email.value = "nope";
		email.dispatchEvent(new Event("input", { bubbles: true }));
		expect($('[data-form--error="email"]').hidden).toBe(true);
		email.dispatchEvent(new Event("change", { bubbles: true }));
		expect($('[data-form--error="email"]').hidden).toBe(false);
	});

	it('sends without checking with data-form--validate="off" or formnovalidate', async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			attributes: 'data-form--validate="off"',
		});
		forms.init();
		submit();
		await settle();
		expect(fetch).toHaveBeenCalledOnce();

		forms.destroy();
		document.body.innerHTML = contactForm({
			extra: '<button id="draft" formnovalidate>Save draft</button>',
		});
		forms.init();
		$("#draft").click();
		await settle();
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("checks groups of checkboxes and radios, described on their fieldset", () => {
		document.body.innerHTML = contactForm({
			extra: `
				<fieldset data-form--field="topics" data-form--min-checked="2" data-form--max-checked="3">
					<legend>Topics</legend>
					${["a", "b", "c", "d"].map((value) => `<input type="checkbox" id="topic-${value}" name="topics[]" value="${value}">`).join("")}
					<p data-form--error="topics"></p>
				</fieldset>
				<fieldset data-form--field="plan" data-form--message-required="Choose a plan">
					<legend>Plan</legend>
					<input type="radio" id="plan-a" name="plan" value="a" required>
					<input type="radio" id="plan-b" name="plan" value="b">
					<p data-form--error="plan"></p>
				</fieldset>`,
		});
		forms.init();
		fill();
		check("#topic-a");
		submit();
		expect($('[data-form--error="topics"]').textContent).toBe(
			"Select at least 2 options",
		);
		expect($('[data-form--error="plan"]').textContent).toBe("Choose a plan");
		const fieldset = $('[data-form--field="plan"]');
		expect(fieldset.getAttribute("aria-describedby")).toBe(
			$('[data-form--error="plan"]').id,
		);
		expect($("#plan-a").getAttribute("aria-invalid")).toBe("true");

		check("#topic-b");
		expect($('[data-form--error="topics"]').hidden).toBe(true);
		check("#topic-c");
		check("#topic-d");
		submit();
		expect($('[data-form--error="topics"]').textContent).toBe(
			"Select no more than 3 options",
		);
		check("#topic-d", false);
		expect($('[data-form--error="topics"]').hidden).toBe(true);
		check("#plan-b");
		expect($('[data-form--error="plan"]').hidden).toBe(true);
	});

	it("checks data-form--match, and the matching field again when the other changes", () => {
		document.body.innerHTML = contactForm({
			extra: `
				<label for="password">Password</label><input id="password" name="password">
				<label for="confirm">Confirm password</label>
				<input id="confirm" name="confirm" data-form--match="password">
				<p data-form--error="confirm"></p>`,
		});
		forms.init();
		fill();
		type("#password", "secret");
		type("#confirm", "secrets");
		submit();
		expect($('[data-form--error="confirm"]').textContent).toBe(
			"Confirm password must match Password",
		);
		type("#password", "secrets");
		expect($('[data-form--error="confirm"]').hidden).toBe(true);
	});

	it("runs custom rules, which skip empty values", () => {
		mockFetch(() => new Promise(() => {}));
		document.body.innerHTML = contactForm({
			extra: `
				<label for="postcode">Postcode</label>
				<input id="postcode" name="postcode" data-form--rule="postcode">
				<p data-form--error="postcode"></p>
				<label for="code">Code</label>
				<input id="code" name="code" data-form--rule="even" data-form--message-even="Use an even number">
				<p data-form--error="code"></p>`,
		});
		const postcode = vi.fn((value: string) =>
			/^[A-Z]{1,2}\d/.test(value) ? true : "Enter a real postcode",
		);
		forms.init({
			rules: { postcode, even: (value) => Number(value) % 2 === 0 },
		});
		fill();
		submit();
		expect(postcode).not.toHaveBeenCalled();

		forms.get("contact")?.destroy();
		forms.refresh();
		type("#postcode", "nope");
		type("#code", "3");
		submit();
		expect($('[data-form--error="postcode"]').textContent).toBe(
			"Enter a real postcode",
		);
		expect($('[data-form--error="code"]').textContent).toBe(
			"Use an even number",
		);
		expect($<HTMLInputElement>("#code").validity.customError).toBe(true);
	});

	it("lists every message in an error list", () => {
		document.body.innerHTML = contactForm().replace(
			'<p data-form--error="email"></p>',
			'<ul data-form--error="email"></ul>',
		);
		forms.init();
		forms.get("contact")?.setErrors({ email: ["First", "Second"] });
		expect(
			$$('[data-form--error="email"] li').map((item) => item.textContent),
		).toEqual(["First", "Second"]);
	});

	it("leaves out honeypot fields", () => {
		mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--honeypot><label>Leave this empty <input name="website" required></label></div>`,
		});
		forms.init();
		fill();
		submit();
		expect(forms.get("contact")?.state.errors).toEqual({});
		expect($('[name="website"]').getAttribute("tabindex")).toBe("-1");
		expect($("[data-form--honeypot]").getAttribute("aria-hidden")).toBe("true");
	});
});

describe("error summary", () => {
	it("lists the errors with links, and takes focus", () => {
		document.body.innerHTML = contactForm({ summary: true });
		forms.init();
		submit();
		const summary = $("[data-form--summary]");
		expect(summary.hidden).toBe(false);
		expect(document.activeElement).toBe(summary);
		const links = $$<HTMLAnchorElement>("[data-form--summary] a");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"#name",
			"#email",
		]);
		expect($("[data-form--status]").textContent).toBe("");

		links[1]?.click();
		expect(document.activeElement).toBe($("#email"));

		fill();
		expect($$("[data-form--summary] li")).toHaveLength(0);
		expect(summary.hidden).toBe(true);
	});
});

describe("server-rendered summaries", () => {
	it("replaces the items the server rendered rather than repeating them", () => {
		document.body.innerHTML = contactForm({ summary: true })
			.replace(
				"<ul><template>",
				'<ul><li><a href="#email">Enter your email</a></li><template>',
			)
			.replace(
				'<p data-form--error="email"></p>',
				'<p data-form--error="email">Enter your email</p>',
			);
		const original = document.body.innerHTML;
		forms.init();
		expect($$("[data-form--summary] li")).toHaveLength(1);
		expect($("[data-form--summary]").hidden).toBe(false);
		forms.destroy();
		expect(document.body.innerHTML).toBe(original);
	});
});

describe("sending", () => {
	it("sends the form and shows the sent message", async () => {
		const fetch = mockFetch(() => Response.json({ message: "Thanks Ada" }));
		document.body.innerHTML = contactForm();
		forms.init();
		const success = vi.fn();
		document.addEventListener("form-success", success);
		fill();
		submit();
		expect($("form").getAttribute("data-form--state")).toBe("submitting");
		expect($("[data-form--status]").textContent).toBe("Sending…");
		expect($("#send").getAttribute("aria-disabled")).toBe("true");
		await settle();

		const request = requestOf(fetch);
		expect(request.method).toBe("POST");
		expect(new URL(request.url).pathname).toBe("/submit");
		expect(request.headers.get("accept")).toBe("application/json");
		expect(await request.text()).toBe("name=Ada&email=ada%40example.com");

		expect($("form").getAttribute("data-form--state")).toBe("success");
		expect($("#send").hasAttribute("aria-disabled")).toBe(false);
		expect($("[data-form--sent]").hidden).toBe(false);
		expect(document.activeElement).toBe($("[data-form--sent]"));
		expect($<HTMLInputElement>("#name").value).toBe("");
		expect(success).toHaveBeenCalledOnce();
		expect(success.mock.calls[0]?.[0].detail.result).toMatchObject({
			ok: true,
			message: "Thanks Ada",
		});
	});

	it("writes the message to the status without a sent element, and keeps values with data-form--reset=false", async () => {
		mockFetch(() => new Response(null, { status: 204 }));
		document.body.innerHTML = contactForm({
			attributes: 'data-form--reset="false"',
		}).replace(/<div data-form--sent>.*?<\/div>/, "");
		forms.init();
		fill();
		submit();
		await settle();
		expect($("[data-form--status]").textContent).toBe(
			"Thank you, your form has been sent.",
		);
		expect($<HTMLInputElement>("#name").value).toBe("Ada");
	});

	it("ignores presses while sending", async () => {
		let respond: (response: Response) => void = () => {};
		const fetch = mockFetch(
			() =>
				new Promise<Response>((resolve) => {
					respond = resolve;
				}),
		);
		document.body.innerHTML = contactForm();
		forms.init();
		fill();
		submit();
		submit();
		await settle();
		expect(fetch).toHaveBeenCalledOnce();
		respond(Response.json({}));
		await settle();
		expect($("form").getAttribute("data-form--state")).toBe("success");
	});

	it("lets form-submit listeners change the data or cancel the send", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		forms.init();
		fill();
		const add = (event: CustomEvent<FormSubmitDetail>) =>
			event.detail.data.append("source", "test");
		document.addEventListener("form-submit", add);
		submit();
		await settle();
		expect(await requestOf(fetch).text()).toContain("source=test");

		document.removeEventListener("form-submit", add);
		const cancel = (event: Event) => event.preventDefault();
		$("form").addEventListener("form-submit", cancel);
		fill();
		submit();
		await settle();
		expect(fetch).toHaveBeenCalledOnce();
		expect($("form").getAttribute("data-form--state")).toBe("idle");
	});

	it("sends the submitter, its formaction and multipart data for files", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `
				<input type="file" name="cv" id="cv">
				<input type="file" name="photo">
				<button id="alt" name="intent" value="save" formaction="/save">Save</button>`,
		});
		forms.init();
		fill();
		const transfer = new DataTransfer();
		transfer.items.add(new File(["cv"], "cv.pdf"));
		$<HTMLInputElement>("#cv").files = transfer.files;
		$("#alt").click();
		await settle();
		const request = requestOf(fetch);
		expect(new URL(request.url).pathname).toBe("/save");
		const data = await request.formData();
		expect(data.get("intent")).toBe("save");
		expect((data.get("cv") as File).name).toBe("cv.pdf");
		expect(data.has("photo")).toBe(false);
	});

	it("reads the form's own attributes when fields are named after them", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<input name="action" value="x"><input name="method" value="y">`,
		});
		forms.init();
		fill();
		submit();
		await settle();
		expect(requestOf(fetch).method).toBe("POST");
		expect(new URL(requestOf(fetch).url).pathname).toBe("/submit");
	});

	it("follows a redirect from the response or data-form--redirect, but only to web pages", async () => {
		const assign = vi.fn();
		vi.stubGlobal("location", { href: window.location.href, assign });
		mockFetch(() => Response.json({ redirect: "javascript:alert(1)" }));
		document.body.innerHTML = contactForm({
			attributes: 'data-form--redirect="/thanks"',
		});
		forms.init();
		fill();
		submit();
		await settle();
		expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/thanks$/));
	});

	it("uses the send and parse options", async () => {
		document.body.innerHTML = contactForm();
		const send = vi.fn(async () => ({
			ok: false,
			errors: { email: "Already subscribed" },
		}));
		forms.init({ send });
		fill();
		const result = await forms.get("contact")?.submit();
		expect(send).toHaveBeenCalledOnce();
		expect(result?.ok).toBe(false);
		expect($('[data-form--error="email"]').textContent).toBe(
			"Already subscribed",
		);
	});
});

describe("responses", () => {
	const sendWith = async (
		response: Response | (() => never),
		summary = false,
	) => {
		mockFetch(() => (typeof response === "function" ? response() : response));
		document.body.innerHTML = contactForm({
			summary,
			extra: `<input type="file" name="files" multiple><p data-form--error="files"></p>`,
		});
		forms.init();
		fill();
		submit();
		await settle();
	};

	it("shows field errors keyed by name, merging indexed names", async () => {
		await sendWith(
			Response.json(
				{
					message: "Check your answers",
					errors: {
						email: ["Already registered"],
						"files.0": "Too large",
						"files.1": ["Wrong type"],
						unknown: "Something else",
					},
				},
				{ status: 422 },
			),
		);
		expect($("form").getAttribute("data-form--state")).toBe("error");
		expect($('[data-form--error="email"]').textContent).toBe(
			"Already registered",
		);
		expect($('[data-form--error="files"]').textContent).toBe(
			"Too large Wrong type",
		);
		expect($("[data-form--status]").textContent).toBe(
			"Check your answers Something else",
		);
		expect(document.activeElement).toBe($("#email"));
	});

	it("shows errors with no error element of their own in the status", async () => {
		mockFetch(() =>
			Response.json(
				{ errors: { _captcha: "Complete the security check" } },
				{ status: 422 },
			),
		);
		document.body.innerHTML = contactForm({
			extra: `<input type="hidden" name="_captcha">`,
		});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		forms.init();
		fill();
		submit();
		await settle();
		expect($("[data-form--status]").textContent).toBe(
			"There is a problem with 1 answer. Check the form and try again. Complete the security check",
		);
	});

	it("reads errors as a list, and refuses success: false", async () => {
		await sendWith(
			Response.json(
				{ errors: [{ path: ["email"], message: "Use a work email" }] },
				{ status: 400 },
			),
		);
		expect($('[data-form--error="email"]').textContent).toBe(
			"Use a work email",
		);

		forms.destroy();
		await sendWith(Response.json({ success: false, message: "Closed" }));
		expect(forms.get("contact")?.state.status).toBe("error");
		expect($("[data-form--status]").textContent).toBe("Closed");
	});

	it("shows the error message for responses it can't read and failed requests", async () => {
		await sendWith(new Response("<h1>Server error</h1>", { status: 500 }));
		expect($("[data-form--status]").textContent).toBe(
			"Your form couldn't be sent. Try again.",
		);
		expect(document.activeElement).not.toBe($("#name"));

		forms.destroy();
		vi.spyOn(console, "error").mockImplementation(() => {});
		await sendWith(() => {
			throw new TypeError("Failed to fetch");
		});
		expect($("form").getAttribute("data-form--state")).toBe("error");
		expect($("[data-form--status]").textContent).toBe(
			"Your form couldn't be sent. Try again.",
		);
	});
});

describe("native submissions", () => {
	it("lets valid GET forms submit natively, and stops invalid ones", () => {
		document.body.innerHTML = `
			<form data-form method="get" action="/search">
				<label for="q">Search</label><input id="q" name="q" required>
				<p data-form--error="q"></p>
				<button>Search</button>
			</form>`;
		forms.init();
		// A synthetic submit event never navigates, and says whether the library cancelled it.
		const allowed = () =>
			$("form").dispatchEvent(
				new SubmitEvent("submit", { bubbles: true, cancelable: true }),
			);
		expect(allowed()).toBe(false);
		type("#q", "shoes");
		expect(allowed()).toBe(true);
		expect($('[data-form--error="q"]').hidden).toBe(true);
	});
});

describe("captcha protocol", () => {
	it("waits for widgets to hand over a token, and resets them after sending", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha id="captcha"><input type="hidden" name="_captcha"></div>`,
		});
		forms.init();
		const slot = $("#captcha");
		const reset = vi.fn();
		slot.addEventListener("captcha:reset", reset);
		let release = () => {};
		slot.addEventListener("captcha:token", (event) => {
			(event as CustomEvent<(wait: Promise<unknown>) => void>).detail(
				new Promise<void>((resolve) => {
					release = () => {
						$<HTMLInputElement>('[name="_captcha"]').value = "token";
						resolve();
					};
				}),
			);
		});
		fill();
		submit();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
		release();
		await settle();
		expect(await requestOf(fetch).text()).toContain("_captcha=token");
		expect(reset).toHaveBeenCalledOnce();
	});

	it("doesn't wait forever for a widget", async () => {
		vi.useFakeTimers();
		const fetch = mockFetch();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha id="captcha"></div>`,
		});
		forms.init();
		$("#captcha").addEventListener("captcha:token", (event) => {
			(event as CustomEvent<(wait: Promise<unknown>) => void>).detail(
				new Promise(() => {}),
			);
		});
		fill();
		submit();
		await vi.advanceTimersByTimeAsync(30000);
		expect(fetch).toHaveBeenCalledOnce();
	});
});

describe("character count", () => {
	it("counts characters, describes its field and announces once typing pauses", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = contactForm({
			extra: `
				<label for="message">Message</label>
				<textarea id="message" name="message" data-form--maxlength="10"></textarea>
				<p data-form--count="message">You can enter up to 10 characters</p>
				<p data-form--error="message"></p>`,
		});
		forms.init();
		const count = $("[data-form--count]");
		expect(count.textContent).toBe("You have 10 characters remaining");
		expect($("#message").getAttribute("aria-describedby")).toBe(count.id);

		type("#message", "Hello there, Ada");
		expect(count.textContent).toBe("You have 6 characters too many");
		expect(count.hasAttribute("data-form--over")).toBe(true);
		await vi.advanceTimersByTimeAsync(1200);
		const announcer = $('form > [aria-live="polite"]');
		expect(announcer.textContent).toBe("You have 6 characters too many");

		fill();
		submit();
		expect($('[data-form--error="message"]').textContent).toBe(
			"Message must be 10 characters or fewer",
		);
		forms.destroy();
		expect(count.textContent).toBe("You can enter up to 10 characters");
	});
});

describe("API", () => {
	it("finds forms by name, id or an element inside them", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		const form = forms.get("contact");
		expect(form?.element).toBe($("form"));
		expect(forms.get($("#email"))).toBe(form);
		document.body.insertAdjacentHTML(
			"beforeend",
			`<form data-form="other" id="x"></form>`,
		);
		forms.refresh();
		expect(forms.get("x")?.element).toBe($("#x"));
	});

	it("validates, sets and clears errors, and tells subscribers", () => {
		document.body.innerHTML = contactForm();
		forms.init();
		const form = forms.get("contact");
		const listener = vi.fn();
		form?.subscribe(listener);
		expect(form?.validate("email")).toBe(false);
		expect(form?.state.errors.email).toHaveLength(1);
		expect(form?.state.errors.name).toBeUndefined();

		form?.setErrors({ name: "Taken" }, { focus: false });
		expect($('[data-form--error="name"]').textContent).toBe("Taken");
		form?.clearErrors("name");
		expect(form?.state.errors.name).toBeUndefined();
		form?.clearErrors();
		expect(form?.state.errors).toEqual({});
		expect(listener).toHaveBeenCalled();
	});

	it("clears errors and hides the sent message on reset", async () => {
		mockFetch();
		document.body.innerHTML = contactForm({
			extra: "",
		}).replace(
			"Thanks, we'll be in touch.",
			`Thanks <button type="reset" id="again">Send another</button>`,
		);
		forms.init();
		fill();
		submit();
		await settle();
		expect($("[data-form--sent]").hidden).toBe(false);
		$("#again").focus();
		$("#again").click();
		expect($("[data-form--sent]").hidden).toBe(true);
		expect($("form").getAttribute("data-form--state")).toBe("idle");
		expect(document.activeElement).toBe($("#name"));
	});

	it("stops working once destroyed", async () => {
		const fetch = mockFetch();
		document.body.innerHTML = contactForm();
		forms.init();
		const form = forms.get("contact");
		form?.destroy();
		expect(forms.get("contact")).toBeUndefined();
		expect(await form?.submit()).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});
});
