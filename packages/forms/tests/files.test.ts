import { describe, expect, it, vi } from "vite-plus/test";
import { files } from "../src/files.js";
import forms from "../src/index.js";
import { $, $$, file, mockFetch, pick, settle, submit } from "./utils.js";

const markup = (
	input = 'multiple accept=".pdf,image/*" data-form--max-size="1KB"',
) => `
	<form data-form="upload" method="post" action="/upload">
		<div data-form--status></div>
		<div data-form--field="docs">
			<div data-form--dropzone id="zone">
				<label for="docs">Documents</label>
				<input type="file" id="docs" name="docs" ${input}>
				<p id="hint">or drop files here</p>
			</div>
			<ul data-form--files="docs">
				<template><li>{name} ({size}) <button data-form--remove>Remove</button></li></template>
			</ul>
			<p data-form--error="docs"></p>
		</div>
		<button id="send">Send</button>
	</form>
`;

const names = () =>
	$$("[data-form--files] li").map((item) =>
		item.firstChild?.textContent?.trim(),
	);

const drag = (type: string, dropped: File[] = []) => {
	const transfer = new DataTransfer();
	for (const item of dropped) transfer.items.add(item);
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", {
		value: { files: transfer.files, types: ["Files"], dropEffect: "none" },
	});
	$("#hint").dispatchEvent(event);
	return event;
};

describe("files", () => {
	it("lists the files with remove buttons, and keeps earlier picks", () => {
		document.body.innerHTML = markup();
		forms.init({ extensions: [files] });
		pick("#docs", [file("a.pdf", 100, "application/pdf")]);
		pick("#docs", [file("b.png", 2048, "image/png")]);
		expect(names()).toEqual(["a.pdf (100 bytes)", "b.png (2 KB)"]);
		expect($<HTMLInputElement>("#docs").files).toHaveLength(2);
		expect($("#zone").hasAttribute("data-form--has-files")).toBe(true);

		const remove = $$("[data-form--remove]");
		expect(remove[0]?.getAttribute("aria-label")).toBe("Remove a.pdf");
		expect(remove[0]?.getAttribute("type")).toBe("button");
	});

	it("removes a file, moves focus to the next and announces it", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = markup("multiple");
		forms.init({ extensions: [files] });
		pick("#docs", [file("a.pdf"), file("b.pdf"), file("c.pdf")]);
		$$("[data-form--remove]")[1]?.click();
		expect(names()).toEqual(["a.pdf (10 bytes)", "c.pdf (10 bytes)"]);
		expect(document.activeElement).toBe($$("[data-form--remove]")[1]);
		$$("[data-form--remove]")[1]?.click();
		$$("[data-form--remove]")[0]?.click();
		expect(document.activeElement).toBe($("#docs"));
		expect($("#zone").hasAttribute("data-form--has-files")).toBe(false);
		await vi.advanceTimersByTimeAsync(200);
		expect($('form > [aria-live="polite"]').textContent).toBe("Removed a.pdf");
	});

	it("takes dropped files and checks them against accept and the size limit", async () => {
		mockFetch();
		document.body.innerHTML = markup();
		forms.init({ extensions: [files] });

		const over = drag("dragenter", [file("a.pdf")]);
		expect(over.defaultPrevented).toBe(true);
		expect($("#zone").hasAttribute("data-form--dragging")).toBe(true);
		drag("dragleave");
		expect($("#zone").hasAttribute("data-form--dragging")).toBe(false);

		drag("dragenter", [file("a.pdf")]);
		const drop = drag("drop", [file("notes.txt", 10, "text/plain")]);
		expect(drop.defaultPrevented).toBe(true);
		expect($("#zone").hasAttribute("data-form--dragging")).toBe(false);
		expect(names()).toEqual(["notes.txt (10 bytes)"]);

		submit();
		expect($('[data-form--error="docs"]').textContent).toBe(
			"notes.txt is not an accepted file type",
		);
		$("[data-form--remove]").click();
		drag("drop", [file("huge.pdf", 4096, "application/pdf")]);
		submit();
		expect($('[data-form--error="docs"]').textContent).toBe(
			"huge.pdf must be smaller than 1 KB",
		);
		$("[data-form--remove]").click();
		expect($('[data-form--error="docs"]').hidden).toBe(true);
		await settle();
	});

	it("keeps one file for inputs without multiple", () => {
		document.body.innerHTML = markup("");
		forms.init({ extensions: [files] });
		drag("drop", [file("a.pdf"), file("b.pdf")]);
		expect(names()).toEqual(["a.pdf (10 bytes)"]);
		pick("#docs", [file("c.pdf")]);
		expect(names()).toEqual(["c.pdf (10 bytes)"]);
	});

	it("empties the list on reset and removes it when destroyed", async () => {
		document.body.innerHTML = markup();
		forms.init({ extensions: [files] });
		pick("#docs", [file("a.pdf", 10, "application/pdf")]);
		// Browsers empty file inputs on reset, which happy-dom doesn't.
		$("form").addEventListener("reset", () =>
			queueMicrotask(() => {
				$<HTMLInputElement>("#docs").value = "";
				$<HTMLInputElement>("#docs").files = new DataTransfer().files;
			}),
		);
		forms.get("upload")?.reset();
		await settle();
		expect(names()).toEqual([]);

		pick("#docs", [file("a.pdf", 10, "application/pdf")]);
		forms.destroy();
		expect(names()).toEqual([]);
		expect($("#zone").hasAttribute("data-form--has-files")).toBe(false);
	});
});
