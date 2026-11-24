import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { loop, uid } from "../src/reactions.js";
import { catalystWarnings } from "./utils.js";

describe("uid reaction", () => {
	it("gives each store and loop item its own ids", () => {
		document.body.innerHTML = `
			<div data-store="a">
				<label data-uid--for="email">Email</label>
				<input data-uid="email" />
			</div>
			<div data-store="b">
				<input data-uid="email" />
			</div>
			<ul data-store="faq" data-loop="$items">
				<template>
					<li>
						<button data-uid--aria-controls="answer" data-uid="question"></button>
						<div data-uid="answer" data-uid--aria-labelledby="question answer"></div>
					</li>
				</template>
			</ul>
		`;
		const faq = defineStore({ state: { items: [1, 2] } });
		Catalyst.init({ stores: { faq }, reactions: [loop, uid] });

		const label = document.querySelector("label");
		const [first, second] = Array.from(document.querySelectorAll("input"));
		expect(first?.id).toMatch(/^catalyst-email-\d+$/);
		expect(label?.htmlFor).toBe(first?.id);
		expect(second?.id).not.toBe(first?.id);

		const items = Array.from(document.querySelectorAll("li"));
		const ids = items.map((item) => {
			const button = item.querySelector("button");
			const answer = item.querySelector("div");
			expect(button?.getAttribute("aria-controls")).toBe(answer?.id);
			expect(answer?.getAttribute("aria-labelledby")).toBe(
				`${button?.id} ${answer?.id}`,
			);
			return answer?.id;
		});
		expect(new Set(ids).size).toBe(2);
	});

	it("restores the attribute when disposed and warns without a name", () => {
		document.body.innerHTML = `
			<div data-store="a">
				<p id="original" data-uid="note"></p>
				<p data-uid="$name"></p>
			</div>
		`;
		Catalyst.init({ reactions: [uid] });
		const p = document.querySelector("p");
		expect(p?.id).toMatch(/^catalyst-note-/);

		p?.removeAttribute("data-uid");
		Catalyst.sync(document.body);
		expect(p?.id).toBe("original");
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('requires a name, such as "panel"'),
		);
	});

	it("skips ids already on the page", () => {
		// Ids count up across tests, so a range is taken to be sure of a clash.
		const taken = Array.from(
			{ length: 200 },
			(_, index) => `<p id="catalyst-taken-${index + 1}"></p>`,
		).join("");
		document.body.innerHTML = `
			${taken}
			<div data-store="a"><p class="target" data-uid="taken"></p></div>
		`;
		Catalyst.init({ reactions: [uid] });
		const id = document.querySelector(".target")?.id ?? "";
		expect(id).toBe("catalyst-taken-201");
	});
});
