import Catalyst from "@lucidclient/catalyst";
import { bind, events, loop } from "@lucidclient/catalyst/reactions";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { carouselStore } from "../src/catalyst.js";
import carousel from "../src/index.js";
import {
	$,
	$$,
	carouselMarkup,
	fakeLayout,
	frame,
	snapStyles,
} from "./utils.js";

const start = () =>
	Catalyst.start({
		stores: { gallery: carouselStore },
		reactions: [bind, events, loop],
	});

const withRef = (markup: string, attributes = "") =>
	markup.replace(
		"data-carousel ",
		`data-carousel data-ref="#carousel" ${attributes} `,
	);

const markup = `${snapStyles}
	<div data-store="gallery">
		${withRef(carouselMarkup(4, { controls: false }))}
		<p id="index" data-bind--data-index="$index" data-bind--data-page="$indexOne" data-bind--data-count="$count"></p>
		<button id="prev" data-events--click="@prev" data-bind--disabled="$atStart">Prev</button>
		<button id="next" data-events--click="@next" data-bind--disabled="$atEnd">Next</button>
		<ol data-loop="$pages">
			<template><li><button class="dot" data-events--click="@goTo" data-bind--aria-current="@isCurrent"></button></li></template>
		</ol>
	</div>
`;

afterEach(async () => {
	await frame();
	Catalyst.destroy();
});

const read = (name: string) => $("#index").getAttribute(`data-${name}`);

describe("carouselStore", () => {
	it("follows the carousel and controls it", async () => {
		document.body.innerHTML = markup;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		start();
		await frame();

		expect(read("index")).toBe("0");
		expect(read("page")).toBe("1");
		expect(read("count")).toBe("4");
		expect($("#prev").hasAttribute("disabled")).toBe(true);
		expect($$(".dot")).toHaveLength(4);
		expect($$(".dot")[0]?.getAttribute("aria-current")).toBe("true");

		$("#next").click();
		await frame();
		expect(read("index")).toBe("1");
		expect($("#prev").hasAttribute("disabled")).toBe(false);

		$$(".dot")[3]?.click();
		await frame();
		expect(read("index")).toBe("3");
		expect($("#next").hasAttribute("disabled")).toBe(true);
		expect($$(".dot")[3]?.getAttribute("aria-current")).toBe("true");
		expect($$(".dot")[1]?.getAttribute("aria-current")).toBe("false");
	});

	it("attaches when the carousel is enhanced after Catalyst starts", async () => {
		document.body.innerHTML = markup;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		start();
		await frame();
		expect(read("count")).toBe("0");
		carousel.init();
		await frame();
		expect(read("count")).toBe("4");

		carousel.destroy();
		await frame();
		expect(read("count")).toBe("0");
	});

	it("works on the store element itself", async () => {
		document.body.innerHTML =
			snapStyles +
			withRef(
				carouselMarkup(3),
				'data-store="gallery" data-bind--data-page="$indexOne"',
			);
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		start();
		await frame();
		const root = $("[data-carousel]");
		expect(root.getAttribute("data-page")).toBe("1");
		$("#next").click();
		await frame();
		expect(root.getAttribute("data-page")).toBe("2");
	});

	it("follows slides a Catalyst loop renders into the track", async () => {
		document.body.innerHTML = `${snapStyles}
			<div data-store="gallery" data-state--photos='["a","b","c"]'>
				<section data-carousel data-ref="#carousel" aria-label="Photos">
					<div data-carousel--track class="track" data-loop="$photos">
						<template><div class="slide" data-bind--data-photo="$item"></div></template>
					</div>
				</section>
				<p id="index" data-bind--data-count="$count"></p>
			</div>`;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		start();
		await frame();
		expect($$(".slide")).toHaveLength(3);
		expect(read("count")).toBe("3");
	});
});
