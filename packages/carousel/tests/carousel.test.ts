import { describe, expect, it, vi } from "vite-plus/test";
import drag from "../src/drag.js";
import carousel from "../src/index.js";
import {
	$,
	$$,
	carouselMarkup,
	fakeLayout,
	frame,
	resize,
	scrollOf,
	scrollTrack,
	snapStyles,
} from "./utils.js";

const setup = (
	count: number,
	options: Parameters<typeof carouselMarkup>[1] = {},
	layout: Partial<Parameters<typeof fakeLayout>[1]> = {},
) => {
	document.body.innerHTML = snapStyles + carouselMarkup(count, options);
	const track = $("[data-carousel--track]");
	fakeLayout(track, { size: 400, slide: 400, ...layout });
	carousel.init({ drag });
	const instance = carousel.get(track);
	if (!instance) throw new Error("The carousel was not created");
	return { track, instance, root: $("[data-carousel]") };
};

describe("setup", () => {
	it("adds carousel and slide semantics the markup leaves out", () => {
		const { root, track } = setup(3);
		expect(root.getAttribute("role")).toBe("region");
		expect(root.getAttribute("aria-roledescription")).toBe("carousel");
		expect(root.hasAttribute("data-carousel--ready")).toBe(true);
		expect(track.id).toMatch(/^carousel-\d+-track$/);

		const slides = $$(".slide");
		expect(slides.map((slide) => slide.getAttribute("role"))).toEqual([
			"group",
			"group",
			"group",
		]);
		expect(slides[1]?.getAttribute("aria-roledescription")).toBe("slide");
		expect(slides[1]?.getAttribute("aria-label")).toBe("2 of 3");

		const next = $("#next");
		expect(next.getAttribute("aria-controls")).toBe(track.id);
		expect(next.getAttribute("type")).toBe("button");
	});

	it("keeps the author's own attributes and list semantics", () => {
		document.body.innerHTML = `${snapStyles}
			<div data-carousel role="group" aria-label="News" aria-roledescription="gallery">
				<ul data-carousel--track id="news" class="track">
					<li class="slide">One</li>
					<li class="slide">Two</li>
				</ul>
			</div>`;
		fakeLayout($("#news"), { size: 400, slide: 400 });
		carousel.init();
		const root = $("[data-carousel]");
		expect(root.getAttribute("role")).toBe("group");
		expect(root.getAttribute("aria-roledescription")).toBe("gallery");
		expect($("#news").id).toBe("news");
		for (const item of $$("li")) {
			expect(item.hasAttribute("role")).toBe(false);
			expect(item.hasAttribute("aria-label")).toBe(false);
		}
	});

	it("warns about a carousel without a track or a name", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `<div data-carousel></div><div data-carousel><div data-carousel--track></div></div>`;
		carousel.init();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("has no data-carousel--track"),
		);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("has no aria-label"),
		);
	});

	it("restores the markup on destroy", () => {
		document.body.innerHTML =
			snapStyles +
			carouselMarkup(4, {
				attributes: "data-carousel--loop",
				extra: `<div data-carousel--markers><template><button>{n}</button></template></div><p data-carousel--status>Status</p>`,
			});
		const before = document.body.innerHTML;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		expect(document.body.innerHTML).not.toBe(before);
		carousel.destroy();
		expect(document.body.innerHTML).toBe(before);
	});
});

describe("pages and navigation", () => {
	it("moves between slides and disables the controls at the ends", async () => {
		const { root, track, instance } = setup(3);
		expect(instance.state).toMatchObject({
			index: 0,
			count: 3,
			atStart: true,
			atEnd: false,
			scrollable: true,
		});
		expect($("#prev").getAttribute("aria-disabled")).toBe("true");
		expect($("#next").hasAttribute("aria-disabled")).toBe(false);
		expect(root.getAttribute("data-carousel--index")).toBe("0");
		expect(root.style.getPropertyValue("--carousel-count")).toBe("3");

		$("#next").click();
		await frame();
		expect(scrollOf(track)).toBe(400);
		expect(instance.state.index).toBe(1);
		expect(root.getAttribute("data-carousel--index")).toBe("1");
		expect($("#prev").hasAttribute("aria-disabled")).toBe(false);

		$("#next").click();
		await frame();
		expect(instance.state).toMatchObject({ index: 2, atEnd: true });
		expect($("#next").getAttribute("aria-disabled")).toBe("true");
		expect(root.hasAttribute("data-carousel--at-end")).toBe(true);

		// Disabled controls do nothing.
		$("#next").click();
		await frame();
		expect(scrollOf(track)).toBe(800);
	});

	it("groups slides that can't snap on their own into the last page", async () => {
		// Ten 100px slides in a 300px track: the last three share the end position.
		const { track, instance } = setup(10, {}, { size: 300, slide: 100 });
		expect(instance.state.count).toBe(8);
		instance.goTo(7);
		await frame();
		expect(scrollOf(track)).toBe(700);
		const active = $$(".slide").filter((slide) =>
			slide.hasAttribute("data-carousel--active"),
		);
		expect(active.map((slide) => slide.id)).toEqual([
			"slide-7",
			"slide-8",
			"slide-9",
		]);
		const visible = $$(".slide").filter((slide) =>
			slide.hasAttribute("data-carousel--visible"),
		);
		expect(visible).toHaveLength(3);
	});

	it("follows the visitor's own scrolling", async () => {
		const { track, instance } = setup(4);
		await scrollTrack(track, 790);
		expect(instance.state.index).toBe(2);
		expect($(".slide:nth-child(3)").hasAttribute("data-carousel--active")).toBe(
			true,
		);
	});

	it("wraps around at the ends with data-carousel--rewind", async () => {
		const { track, instance } = setup(3, {
			attributes: "data-carousel--rewind",
		});
		expect($("#prev").hasAttribute("aria-disabled")).toBe(false);
		$("#prev").click();
		await frame();
		expect(instance.state.index).toBe(2);
		$("#next").click();
		await frame();
		expect(instance.state.index).toBe(0);
		expect(scrollOf(track)).toBe(0);
	});

	it("goes from the target of a scroll that hasn't finished", async () => {
		const { track, instance } = setup(5);
		// Hold back scrollend, as a smooth scroll would.
		track.scrollTo = ((options: ScrollToOptions) => {
			pending = options.left ?? 0;
		}) as typeof track.scrollTo;
		let pending = 0;
		instance.next();
		instance.next();
		expect(pending).toBe(800);
	});

	it("isn't scrollable when every slide fits", () => {
		const { instance } = setup(3, {}, { size: 400, slide: 100 });
		expect(instance.state).toMatchObject({
			count: 1,
			scrollable: false,
			atStart: true,
			atEnd: true,
		});
		expect($("#prev").getAttribute("aria-disabled")).toBe("true");
		expect($("#next").getAttribute("aria-disabled")).toBe("true");
	});

	it("measures right to left tracks from their start edge", async () => {
		document.body.innerHTML =
			snapStyles.replace(".track {", ".track { direction: rtl;") +
			carouselMarkup(3);
		const track = $(".track");
		fakeLayout(track, { size: 400, slide: 400, rtl: true });
		carousel.init();
		$("#next").click();
		await frame();
		expect(track.scrollLeft).toBe(-400);
		expect(carousel.get(track)?.state.index).toBe(1);
	});

	it("scrolls vertical tracks", async () => {
		document.body.innerHTML =
			snapStyles.replace("x mandatory", "y mandatory") + carouselMarkup(3);
		const track = $(".track");
		fakeLayout(track, { size: 400, slide: 400, vertical: true });
		carousel.init();
		$("#next").click();
		await frame();
		expect(track.scrollTop).toBe(400);
		expect(carousel.get(track)?.state.index).toBe(1);
	});

	it("follows centred snapping and scroll-padding", () => {
		document.body.innerHTML = `
			<style>
				.track { display: flex; scroll-snap-type: x mandatory; scroll-padding-left: 50px; }
				.slide { scroll-snap-align: center; }
			</style>
			${carouselMarkup(5)}`;
		const track = $(".track");
		fakeLayout(track, { size: 400, slide: 200 });
		carousel.init();
		const instance = carousel.get(track);
		instance?.goTo(1);
		// Centred in the 350px snapport after the padding: 300 - 50 - 175.
		expect(scrollOf(track)).toBe(75);
	});
});

describe("markers", () => {
	it("generates one marker per page from a template", async () => {
		const { track, instance } = setup(
			10,
			{
				extra: `<div data-carousel--markers><template><button class="dot" title="Page {n} of {count}"></button></template></div>`,
			},
			{ size: 300, slide: 100 },
		);
		const dots = $$(".dot");
		expect(dots).toHaveLength(8);
		expect(dots[2]?.getAttribute("title")).toBe("Page 3 of 8");
		expect(dots[2]?.getAttribute("aria-label")).toBe("Go to slide 3");
		expect(dots[2]?.getAttribute("type")).toBe("button");
		expect(dots[2]?.getAttribute("aria-controls")).toBe(track.id);
		expect(dots[0]?.getAttribute("aria-current")).toBe("true");

		dots[4]?.click();
		await frame();
		expect(instance.state.index).toBe(4);
		expect(dots[0]?.hasAttribute("aria-current")).toBe(false);
		expect(dots[4]?.getAttribute("aria-current")).toBe("true");
	});

	it("keeps markers with their own text unlabelled", () => {
		setup(3, {
			extra: `<div data-carousel--markers><template><button class="dot">{n}</button></template></div>`,
		});
		expect($$(".dot").map((dot) => dot.textContent)).toEqual(["1", "2", "3"]);
		expect($(".dot").hasAttribute("aria-label")).toBe(false);
	});

	it("maps authored links to the slides they point at", async () => {
		const { instance } = setup(3, {
			extra: `<nav aria-label="Slides">
				<a href="#slide-2" class="link">Three</a>
				<a href="#slide-0" class="link" data-carousel--marker>One</a>
				<a href="#slide-2" class="link" data-carousel--marker>Three</a>
			</nav>`,
		});
		const [, first, third] = $$<HTMLAnchorElement>(".link");
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		third?.dispatchEvent(click);
		await frame();
		expect(click.defaultPrevented).toBe(true);
		expect(instance.state.index).toBe(2);
		expect(third?.getAttribute("aria-current")).toBe("true");
		expect(first?.hasAttribute("aria-current")).toBe(false);
	});

	it("maps numbered buttons to slides from 0", async () => {
		const { instance } = setup(3, {
			extra: `<button id="third" data-carousel--marker="2">Third</button>`,
		});
		$("#third").click();
		await frame();
		expect(instance.state.index).toBe(2);
	});

	it("accepts controls outside the carousel with aria-controls", async () => {
		document.body.innerHTML = `${snapStyles}${carouselMarkup(3, { controls: false })}
			<button id="outside" data-carousel--action="next" aria-controls="photos">Next</button>`;
		const track = $(".track");
		track.id = "photos";
		fakeLayout(track, { size: 400, slide: 400 });
		carousel.init();
		$("#outside").click();
		await frame();
		expect(carousel.get(track)?.state.index).toBe(1);
	});
});

describe("looping", () => {
	const orders = () => $$(".slide").map((slide) => Number(slide.style.order));
	const visualOrder = () =>
		$$(".slide")
			.map((slide) => ({ id: slide.id, order: Number(slide.style.order) }))
			.sort((a, b) => a.order - b.order)
			.map((slide) => slide.id.replace("slide-", ""))
			.join("");

	it("rotates the slides so there is always one either side", async () => {
		const { track, instance } = setup(5, {
			attributes: "data-carousel--loop",
		});
		// Slide 0 sits in the middle, still on screen.
		expect(visualOrder()).toBe("34012");
		expect(scrollOf(track)).toBe(800);
		expect(instance.state).toMatchObject({
			index: 0,
			count: 5,
			atStart: false,
			atEnd: false,
		});
		expect($("#prev").hasAttribute("aria-disabled")).toBe(false);

		$("#prev").click();
		await frame();
		expect(instance.state.index).toBe(4);
		// It settled, so it rotated again around slide 4.
		expect(visualOrder()).toBe("23401");
		expect(scrollOf(track)).toBe(800);
	});

	it("keeps going forwards past the last slide", async () => {
		const { instance } = setup(5, { attributes: "data-carousel--loop" });
		const seen: number[] = [];
		for (let i = 0; i < 7; i++) {
			$("#next").click();
			await frame();
			seen.push(instance.state.index);
		}
		expect(seen).toEqual([1, 2, 3, 4, 0, 1, 2]);
	});

	it("leaves the DOM order alone", async () => {
		setup(5, { attributes: "data-carousel--loop" });
		$("#next").click();
		await frame();
		expect($$(".slide").map((slide) => slide.id)).toEqual([
			"slide-0",
			"slide-1",
			"slide-2",
			"slide-3",
			"slide-4",
		]);
		expect(orders().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
	});

	it("takes the shortest way round to a marker", async () => {
		const { track, instance } = setup(6, {
			attributes: "data-carousel--loop",
		});
		const start = scrollOf(track);
		const targets: number[] = [];
		const scrollTo = track.scrollTo.bind(track);
		track.scrollTo = ((options: ScrollToOptions) => {
			targets.push(options.left ?? 0);
			scrollTo(options);
		}) as typeof track.scrollTo;
		instance.goTo(5);
		await frame();
		expect(instance.state.index).toBe(5);
		// Slide 5 sits just before slide 0, so it scrolled back one slide rather than forward five.
		expect(targets).toEqual([start - 400]);
	});

	it("loops with several slides in view", async () => {
		const { instance } = setup(
			6,
			{ attributes: "data-carousel--loop" },
			{ size: 300, slide: 100 },
		);
		expect(instance.state.count).toBe(6);
		const seen: number[] = [];
		for (let i = 0; i < 8; i++) {
			$("#next").click();
			await frame();
			seen.push(instance.state.index);
		}
		expect(seen).toEqual([1, 2, 3, 4, 5, 0, 1, 2]);
		const back: number[] = [];
		for (let i = 0; i < 4; i++) {
			$("#prev").click();
			await frame();
			back.push(instance.state.index);
		}
		expect(back).toEqual([1, 0, 5, 4]);
	});

	it("loops with only one slide more than fits", async () => {
		const { instance } = setup(
			4,
			{ attributes: "data-carousel--loop" },
			{ size: 300, slide: 100 },
		);
		const seen: number[] = [];
		for (let i = 0; i < 5; i++) {
			$("#next").click();
			await frame();
			seen.push(instance.state.index);
		}
		expect(seen).toEqual([1, 2, 3, 0, 1]);
		const back: number[] = [];
		for (let i = 0; i < 3; i++) {
			$("#prev").click();
			await frame();
			back.push(instance.state.index);
		}
		expect(back).toEqual([0, 3, 2]);
	});

	it("stops at the ends with too few slides, and warns", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { instance } = setup(2, { attributes: "data-carousel--loop" });
		expect(instance.state.atStart).toBe(true);
		expect(orders()).toEqual([0, 0]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("Looping needs"));
	});

	it("keeps the slide in view when slides are added", async () => {
		const { track, instance } = setup(5, {
			attributes: "data-carousel--loop",
		});
		$("#next").click();
		await frame();
		const slide = document.createElement("div");
		slide.className = "slide";
		slide.id = "slide-5";
		track.append(slide);
		await frame();
		expect(instance.state.count).toBe(6);
		const current = $$(".slide").find((element) =>
			element.hasAttribute("data-carousel--active"),
		);
		expect(current?.id).toBe("slide-1");
		expect(slide.style.order).not.toBe("");
	});
});

describe("status", () => {
	it("announces pages the visitor moves to, but not on load", async () => {
		const { track } = setup(3, {
			extra: `<p data-carousel--status></p>`,
		});
		const status = $("[data-carousel--status]");
		expect(status.getAttribute("aria-live")).toBe("polite");
		expect(status.getAttribute("aria-atomic")).toBe("true");
		expect(status.textContent).toBe("");

		$("#next").click();
		await frame();
		expect(status.textContent).toBe("Slide 2 of 3");

		await scrollTrack(track, 800);
		await frame();
		expect(status.textContent).toBe("Slide 3 of 3");
	});

	it("uses the labels passed to init", async () => {
		document.body.innerHTML =
			snapStyles +
			carouselMarkup(3, { extra: `<p data-carousel--status></p>` });
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init({
			labels: {
				status: "Diapositive {n} sur {count}",
				slide: "{n} sur {count}",
			},
		});
		expect($("#slide-0").getAttribute("aria-label")).toBe("1 sur 3");
		$("#next").click();
		await frame();
		expect($("[data-carousel--status]").textContent).toBe(
			"Diapositive 2 sur 3",
		);
	});

	it("translates the role descriptions", () => {
		document.body.innerHTML = snapStyles + carouselMarkup(3);
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init({
			labels: { carouselRole: "carrousel", slideRole: "diapositive" },
		});
		expect($("[data-carousel]").getAttribute("aria-roledescription")).toBe(
			"carrousel",
		);
		expect($("#slide-0").getAttribute("aria-roledescription")).toBe(
			"diapositive",
		);
	});

	it("uses a carousel's own labels from data-carousel--label attributes", async () => {
		document.body.innerHTML = `${snapStyles}
			${carouselMarkup(3, {
				attributes:
					'id="own" data-carousel--label-status="Photo {n} of {count}" data-carousel--label-slide-role="photo"',
				extra: `<p data-carousel--status></p>`,
			})}
			<section data-carousel aria-label="Other" id="other">
				<div data-carousel--track class="track"><div class="slide">1</div><div class="slide">2</div></div>
			</section>`;
		for (const track of $$(".track"))
			fakeLayout(track, { size: 400, slide: 400 });
		carousel.init({ labels: { slide: "{n} sur {count}" } });
		expect($("#slide-0").getAttribute("aria-roledescription")).toBe("photo");
		expect($("#slide-0").getAttribute("aria-label")).toBe("1 sur 3");
		expect($("#other .slide").getAttribute("aria-roledescription")).toBe(
			"slide",
		);
		$("#next").click();
		await frame();
		expect($("[data-carousel--status]").textContent).toBe("Photo 2 of 3");
	});
});

describe("autoplay", () => {
	const wait = (ms: number) =>
		new Promise((resolve) => setTimeout(resolve, ms));

	it("moves on by itself, wrapping at the end, without announcing", async () => {
		const { instance, root } = setup(3, {
			attributes: 'data-carousel--autoplay="20"',
			extra: `<p data-carousel--status></p>`,
		});
		expect(instance.state.playing).toBe(true);
		expect(root.hasAttribute("data-carousel--playing")).toBe(true);
		const seen: number[] = [];
		instance.subscribe((state) => {
			if (seen[seen.length - 1] !== state.index) seen.push(state.index);
		});
		await wait(120);
		await frame();
		expect(seen.slice(0, 3)).toEqual([1, 2, 0]);
		expect($("[data-carousel--status]").textContent).toBe("");
	});

	it("switches to a new interval on refresh", async () => {
		const { instance, root } = setup(3, {
			attributes: 'data-carousel--autoplay="10000"',
		});
		root.setAttribute("data-carousel--autoplay", "20");
		instance.refresh();
		await wait(60);
		await frame();
		expect(instance.state.index).toBeGreaterThan(0);
		expect(instance.state.playing).toBe(true);
	});

	it("holds while hovered and stops when focus moves in", async () => {
		const { instance, root } = setup(3, {
			attributes: 'data-carousel--autoplay="20"',
		});
		root.dispatchEvent(
			new PointerEvent("pointerenter", { pointerType: "mouse" }),
		);
		await wait(40);
		expect(instance.state.index).toBe(0);
		expect(instance.state.playing).toBe(true);
		root.dispatchEvent(
			new PointerEvent("pointerleave", { pointerType: "mouse" }),
		);
		await wait(30);
		await frame();
		expect(instance.state.index).toBe(1);

		$("#slide-0").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		expect(instance.state.playing).toBe(false);
		expect(root.hasAttribute("data-carousel--playing")).toBe(false);
	});

	it("labels an icon-only toggle and starts and stops with it", async () => {
		const { instance } = setup(3, {
			attributes: 'data-carousel--autoplay="1000"',
			extra: `<button id="toggle" data-carousel--action="toggle"><svg aria-hidden="true"></svg></button>`,
		});
		const toggle = $("#toggle");
		expect(toggle.getAttribute("aria-label")).toBe("Stop automatic slide show");
		// A press moves focus without stopping autoplay, so the click toggles it.
		const press = () => {
			toggle.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					pointerType: "mouse",
				}),
			);
			toggle.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
			toggle.click();
		};
		press();
		expect(instance.state.playing).toBe(false);
		expect(toggle.getAttribute("aria-label")).toBe(
			"Start automatic slide show",
		);
		press();
		expect(instance.state.playing).toBe(true);
		await wait(10);

		// Keyboard focus reaching the toggle stops autoplay, as the pattern asks.
		toggle.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		expect(instance.state.playing).toBe(false);
	});

	it("warns when autoplay has no control to stop it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		setup(3, { attributes: 'data-carousel--autoplay="1000"' });
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('no data-carousel--action="toggle"'),
		);
	});

	it("stops when the visitor moves the carousel", async () => {
		const { instance } = setup(3, {
			attributes: 'data-carousel--autoplay="1000"',
		});
		$("#next").click();
		await frame();
		expect(instance.state.playing).toBe(false);
	});

	it("doesn't start for visitors who prefer reduced motion", () => {
		vi.spyOn(window, "matchMedia").mockImplementation(
			(query: string) =>
				({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
		);
		const { instance } = setup(3, {
			attributes: 'data-carousel--autoplay="1000"',
		});
		expect(instance.state.playing).toBe(false);
		instance.play();
		expect(instance.state.playing).toBe(true);
	});
});

describe("inert", () => {
	it("makes slides out of view inert, but not one holding focus", async () => {
		const { track } = setup(3, {
			attributes: "data-carousel--inert",
		});
		const inert = () =>
			$$(".slide").map((slide) => slide.hasAttribute("inert"));
		expect(inert()).toEqual([false, true, true]);
		$("#next").click();
		await frame();
		expect(inert()).toEqual([true, false, true]);

		const link = document.createElement("a");
		link.href = "#";
		$("#slide-1").append(link);
		link.focus();
		await scrollTrack(track, 800);
		await frame();
		expect(inert()).toEqual([true, false, false]);
	});
});

describe("events and API", () => {
	it("dispatches carousel-change and tells subscribers", async () => {
		const { root, instance } = setup(3);
		const changes: unknown[] = [];
		const states: number[] = [];
		root.addEventListener("carousel-change", (event) =>
			changes.push((event as CustomEvent).detail),
		);
		const unsubscribe = instance.subscribe((state) => states.push(state.index));
		$("#next").click();
		await frame();
		expect(changes).toEqual([{ index: 1, previousIndex: 0, count: 3 }]);
		expect(states).toContain(1);
		unsubscribe();
		$("#next").click();
		await frame();
		expect(states).not.toContain(2);
	});

	it("picks up slides added to the track", async () => {
		const { track, instance } = setup(2);
		const slide = document.createElement("div");
		slide.className = "slide";
		track.append(slide);
		await frame();
		expect(instance.state.count).toBe(3);
		expect(slide.getAttribute("aria-label")).toBe("3 of 3");
	});

	it("refreshes new and removed carousels", () => {
		const { root } = setup(2);
		const second = document.createElement("div");
		second.innerHTML = carouselMarkup(2).replace("Gallery", "Second");
		document.body.append(second);
		fakeLayout(second.querySelector<HTMLElement>(".track")!, {
			size: 400,
			slide: 400,
		});
		root.remove();
		carousel.refresh();
		expect(carousel.get(root)).toBeUndefined();
		expect(root.hasAttribute("data-carousel--ready")).toBe(false);
		expect(
			carousel.get(second.querySelector<HTMLElement>(".track")!)?.state.count,
		).toBe(2);
	});

	it("keeps nested carousels apart", () => {
		document.body.innerHTML = `${snapStyles}
			<div data-carousel aria-label="Outer" id="outer">
				<div data-carousel--track class="track" id="outer-track">
					<div class="slide">
						<div data-carousel aria-label="Inner" id="inner">
							<div data-carousel--track class="track" id="inner-track">
								<div class="slide">A</div><div class="slide">B</div><div class="slide">C</div>
							</div>
							<button data-carousel--action="next" id="inner-next">Next</button>
						</div>
					</div>
					<div class="slide">Two</div>
				</div>
			</div>`;
		fakeLayout($("#outer-track"), { size: 400, slide: 400 });
		fakeLayout($("#inner-track"), { size: 400, slide: 400 });
		carousel.init();
		expect(carousel.get("outer")?.state.count).toBe(2);
		expect(carousel.get("inner")?.state.count).toBe(3);
		expect($("#inner-next").getAttribute("aria-controls")).toBe("inner-track");
	});
});

describe("mouse drag", () => {
	const wait = (ms: number) =>
		new Promise((resolve) => setTimeout(resolve, ms));
	const pointer = (type: string, x: number) =>
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType: "mouse",
			pointerId: 1,
			button: 0,
			buttons: type === "pointerup" ? 0 : 1,
			clientX: x,
			clientY: 10,
		});

	it("drags the track and settles on the nearest page", async () => {
		const { track, root, instance } = setup(4, {
			attributes: "data-carousel--drag",
		});
		track.dispatchEvent(pointer("pointerdown", 300));
		track.dispatchEvent(pointer("pointermove", 200));
		expect(root.hasAttribute("data-carousel--dragging")).toBe(true);
		expect(track.style.getPropertyValue("scroll-snap-type")).toBe("none");
		expect(scrollOf(track)).toBe(100);
		track.dispatchEvent(pointer("pointermove", -50));
		expect(scrollOf(track)).toBe(350);
		// Holding still before letting go means there is no speed to carry on with.
		await wait(120);
		track.dispatchEvent(pointer("pointerup", -50));
		await frame();
		expect(root.hasAttribute("data-carousel--dragging")).toBe(false);
		expect(instance.state.index).toBe(1);
		expect(scrollOf(track)).toBe(400);
		expect(track.style.getPropertyValue("scroll-snap-type")).toBe("");
	});

	it("swallows the click that ends a drag, but not a plain click", async () => {
		const { track } = setup(4, {
			attributes: "data-carousel--drag",
		});
		const clicks: string[] = [];
		$("#slide-0").addEventListener("click", () => clicks.push("click"));

		track.dispatchEvent(pointer("pointerdown", 300));
		track.dispatchEvent(pointer("pointerup", 300));
		$("#slide-0").click();
		expect(clicks).toEqual(["click"]);

		track.dispatchEvent(pointer("pointerdown", 300));
		track.dispatchEvent(pointer("pointermove", 250));
		track.dispatchEvent(pointer("pointerup", 250));
		$("#slide-0").click();
		expect(clicks).toEqual(["click"]);
		await frame();
	});

	it("carries on in the direction of a quick release", async () => {
		const { track, instance } = setup(4, {
			attributes: "data-carousel--drag",
		});
		track.dispatchEvent(pointer("pointerdown", 300));
		track.dispatchEvent(pointer("pointermove", 290));
		await wait(20);
		track.dispatchEvent(pointer("pointermove", 260));
		// Only 40px from the first slide, but moving, so it goes on to the next.
		track.dispatchEvent(pointer("pointerup", 260));
		await frame();
		expect(instance.state.index).toBe(1);
	});

	it("keeps a flick's direction across a loop rotation", async () => {
		const { track, instance } = setup(5, {
			attributes: "data-carousel--drag data-carousel--loop",
		});
		expect(scrollOf(track)).toBe(800);
		track.dispatchEvent(pointer("pointerdown", 1000));
		for (let x = 900; x >= 450; x -= 50)
			track.dispatchEvent(pointer("pointermove", x));
		// Only the quick part of the drag counts towards the release speed.
		await wait(120);
		const before = instance.state.index;
		// Dragging forwards past 1400 rotates the slides, which moves the scroll position back 400px.
		for (let x = 440; x >= 380; x -= 20)
			track.dispatchEvent(pointer("pointermove", x));
		track.dispatchEvent(pointer("pointerup", 380));
		await frame();
		// A fast flick may carry on past the next slide, but never goes back.
		expect([(before + 1) % 5, (before + 2) % 5]).toContain(
			instance.state.index,
		);
	});

	it("warns when drag wasn't passed to init", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML =
			snapStyles + carouselMarkup(3, { attributes: "data-carousel--drag" });
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("drag wasn't passed to carousel.init()"),
		);
	});

	it("ignores touch, which scrolls natively", () => {
		const { track } = setup(4, { attributes: "data-carousel--drag" });
		track.dispatchEvent(
			new PointerEvent("pointerdown", { pointerType: "touch", clientX: 300 }),
		);
		track.dispatchEvent(
			new PointerEvent("pointermove", { pointerType: "touch", clientX: 100 }),
		);
		expect(scrollOf(track)).toBe(0);
	});

	it("drags past the end while looping", async () => {
		const { track, instance } = setup(5, {
			attributes: "data-carousel--drag data-carousel--loop",
		});
		track.dispatchEvent(pointer("pointerdown", 1000));
		// Five slides of 400px start in the middle at 800, so dragging 2000px goes round.
		for (let x = 1000; x >= -1000; x -= 100)
			track.dispatchEvent(pointer("pointermove", x));
		await wait(120);
		track.dispatchEvent(pointer("pointerup", -1000));
		await frame();
		expect(instance.state.index).toBe(0);
	});
});

describe("review regressions", () => {
	const wait = (ms: number) =>
		new Promise((resolve) => setTimeout(resolve, ms));
	/** Holds back the end of a library scroll, as a smooth scroll would. */
	const holdScrolls = (track: HTMLElement) => {
		const targets: number[] = [];
		track.scrollTo = ((options: ScrollToOptions) => {
			targets.push(options.left ?? 0);
		}) as typeof track.scrollTo;
		return targets;
	};

	it("rewinds instead of looping when the track can't scroll a whole slide", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { instance } = setup(
			4,
			{ attributes: "data-carousel--loop" },
			{ size: 360, slide: 100 },
		);
		expect($$(".slide").every((slide) => slide.style.order === "")).toBe(true);
		expect(instance.state.count).toBe(2);
		$("#next").click();
		await frame();
		expect(instance.state.index).toBe(1);
		$("#next").click();
		await frame();
		expect(instance.state.index).toBe(0);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("rewinds"));
	});

	it("reaches the second page of two quick presses while looping", async () => {
		const { track, instance } = setup(
			4,
			{ attributes: "data-carousel--loop" },
			{ size: 300, slide: 100 },
		);
		const targets = holdScrolls(track);
		instance.next();
		instance.next();
		// The second press finishes the first scroll, then goes one more.
		await scrollTrack(track, targets[targets.length - 1] ?? 0);
		expect(instance.state.index).toBe(2);
	});

	it("replaces a scroll in progress that heads back to where it started", async () => {
		const { track, instance } = setup(3);
		const targets = holdScrolls(track);
		instance.next();
		instance.prev();
		expect(targets).toEqual([400, 0]);
		await frame();
		expect(instance.state.index).toBe(0);
	});

	it("keeps heading for its page when the slides resize mid-scroll", async () => {
		document.body.innerHTML = snapStyles + carouselMarkup(5);
		const track = $(".track");
		const layout = { size: 400, slide: 100 };
		fakeLayout(track, layout);
		carousel.init();
		const instance = carousel.get(track);
		const targets = holdScrolls(track);
		instance?.goTo(1);
		expect(targets).toEqual([100]);
		layout.slide = 200;
		instance?.refresh();
		expect(targets[targets.length - 1]).toBe(200);
	});

	it("reads percentage scroll-padding against the track", () => {
		document.body.innerHTML = `
			<style>
				.track { display: flex; scroll-snap-type: x mandatory; scroll-padding-left: 10%; }
				.slide { scroll-snap-align: start; }
			</style>
			${carouselMarkup(4)}`;
		const track = $(".track");
		fakeLayout(track, { size: 300, slide: 100 });
		carousel.init();
		carousel.get(track)?.goTo(1);
		expect(scrollOf(track)).toBe(70);
	});

	it("keeps the slide in view when one is added before it", async () => {
		const { track, instance, root } = setup(5);
		$("#next").click();
		await frame();
		const changes: number[] = [];
		root.addEventListener("carousel-change", (event) =>
			changes.push((event as CustomEvent).detail.index),
		);
		const slide = document.createElement("div");
		slide.className = "slide";
		slide.id = "slide-new";
		track.prepend(slide);
		await frame();
		const active = $$(".slide").find((element) =>
			element.hasAttribute("data-carousel--active"),
		);
		expect(active?.id).toBe("slide-1");
		expect(instance.state.index).toBe(2);
		expect(changes).toEqual([2]);
	});

	it("keeps the slide in view when one is added before it while looping", async () => {
		const { track } = setup(5, { attributes: "data-carousel--loop" });
		$("#next").click();
		await frame();
		const slide = document.createElement("div");
		slide.className = "slide";
		slide.id = "slide-new";
		track.prepend(slide);
		await frame();
		const active = $$(".slide").find((element) =>
			element.hasAttribute("data-carousel--active"),
		);
		expect(active?.id).toBe("slide-1");
	});

	it("doesn't come back to life after destroy", async () => {
		const { root, instance } = setup(3, {
			extra: `<p data-carousel--status><span>Ready</span></p>`,
		});
		instance.destroy();
		instance.play();
		instance.next();
		await wait(20);
		expect(root.hasAttribute("data-carousel--ready")).toBe(false);
		expect(root.hasAttribute("data-carousel--playing")).toBe(false);
		expect($("[data-carousel--status]").innerHTML).toBe("<span>Ready</span>");
	});

	it("puts a status element's own content back after announcing", async () => {
		const { instance } = setup(3, {
			extra: `<p data-carousel--status><span>Ready</span></p>`,
		});
		instance.next();
		await frame();
		expect($("[data-carousel--status]").textContent).toBe("Slide 2 of 3");
		carousel.destroy();
		expect($("[data-carousel--status]").innerHTML).toBe("<span>Ready</span>");
	});

	it("rebuilds generated markers when the template changes or goes", () => {
		const { instance } = setup(3, {
			extra: `<div data-carousel--markers><template><button class="dot">{n}</button></template></div>`,
		});
		const template = $<HTMLTemplateElement>("template");
		template.innerHTML = `<button class="pill">{n}</button>`;
		instance.refresh();
		expect($$(".dot")).toHaveLength(0);
		expect($$(".pill")).toHaveLength(3);
		template.remove();
		instance.refresh();
		expect($$(".pill")).toHaveLength(0);
	});

	it("moves focus to the replacement of a rebuilt marker", async () => {
		const { track } = setup(4, {
			extra: `<div data-carousel--markers><template><button class="dot">{n}</button></template></div>`,
		});
		$$(".dot")[1]?.focus();
		track.lastElementChild?.remove();
		await frame();
		expect($$(".dot")).toHaveLength(3);
		expect(document.activeElement).toBe($$(".dot")[1]);
	});

	it("leaves slides with their own semantics, and authored inert, alone", async () => {
		document.body.innerHTML = `${snapStyles}
			<div data-carousel aria-label="Products" data-carousel--inert>
				<div data-carousel--track class="track">
					<a href="#a" class="slide" id="a">Product A</a>
					<div class="slide" id="b" inert>Product B</div>
					<div class="slide" id="c">Product C</div>
				</div>
				<button id="next" data-carousel--action="next">Next</button>
			</div>`;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		expect($("#a").hasAttribute("role")).toBe(false);
		expect($("#a").hasAttribute("aria-label")).toBe(false);
		expect($("#c").getAttribute("role")).toBe("group");
		$("#next").click();
		await frame();
		expect($("#b").hasAttribute("inert")).toBe(true);
	});

	it("makes a slide inert once focus leaves it", async () => {
		const { track } = setup(3, { attributes: "data-carousel--inert" });
		const link = document.createElement("a");
		link.href = "#";
		$("#slide-0").append(link);
		link.focus();
		await scrollTrack(track, 400);
		await frame();
		expect($("#slide-0").hasAttribute("inert")).toBe(false);
		link.blur();
		link.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
		await wait(10);
		expect($("#slide-0").hasAttribute("inert")).toBe(true);
	});

	it("leaves a control alone that operates a different carousel", async () => {
		document.body.innerHTML = `${snapStyles}
			<section data-carousel aria-label="A" id="a">
				<div data-carousel--track class="track" id="a-track">
					<div class="slide">1</div><div class="slide">2</div>
				</div>
				<button id="b-prev" data-carousel--action="prev" aria-controls="b-track">B previous</button>
			</section>
			<section data-carousel aria-label="B" id="b">
				<div data-carousel--track class="track" id="b-track">
					<div class="slide">1</div><div class="slide">2</div>
				</div>
			</section>`;
		fakeLayout($("#a-track"), { size: 400, slide: 400 });
		fakeLayout($("#b-track"), { size: 400, slide: 400 });
		carousel.init();
		carousel.get("b")?.goTo(1);
		await frame();
		carousel.get("a")?.refresh();
		expect($("#b-prev").hasAttribute("aria-disabled")).toBe(false);
		$("#b-prev").click();
		await frame();
		expect(carousel.get("b")?.state.index).toBe(0);
		expect(carousel.get("a")?.state.index).toBe(0);
	});

	it("doesn't dispatch carousel-change while starting on a later page", () => {
		document.body.innerHTML = snapStyles + carouselMarkup(3);
		const track = $(".track");
		fakeLayout(track, { size: 400, slide: 400 });
		track.scrollLeft = 400;
		const changes: unknown[] = [];
		document.addEventListener("carousel-change", (event) =>
			changes.push(event),
		);
		carousel.init();
		expect(carousel.get(track)?.state.index).toBe(1);
		expect(changes).toHaveLength(0);
	});
});

describe("second review regressions", () => {
	const holdScrolls = (track: HTMLElement) => {
		const targets: number[] = [];
		track.scrollTo = ((options: ScrollToOptions) => {
			targets.push(options.left ?? 0);
		}) as typeof track.scrollTo;
		return targets;
	};

	it("rewinds when scroll-padding keeps neighbouring pages out of reach", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `
			<style>
				.track { display: flex; scroll-snap-type: x mandatory; scroll-padding-left: 20px; }
				.slide { scroll-snap-align: start; }
			</style>
			${carouselMarkup(4, { attributes: "data-carousel--loop" })}`;
		const track = $(".track");
		fakeLayout(track, { size: 300, slide: 100 });
		carousel.init();
		const instance = carousel.get(track);
		const seen: number[] = [];
		for (let i = 0; i < 3; i++) {
			$("#next").click();
			await frame();
			seen.push(instance?.state.index ?? -1);
		}
		expect(new Set(seen).size).toBeGreaterThan(1);
	});

	it("keeps heading for the same slide when the pages change mid-scroll", () => {
		document.body.innerHTML = `
			<style>
				.track { display: flex; scroll-snap-type: x mandatory; }
				.slide { scroll-snap-align: center; }
			</style>
			${carouselMarkup(7)}`;
		const track = $(".track");
		const layout = { size: 100, slide: 100 };
		fakeLayout(track, layout);
		carousel.init();
		const instance = carousel.get(track);
		const targets = holdScrolls(track);
		instance?.goTo(2);
		layout.size = 300;
		instance?.refresh();
		// The third slide's centre is at 250, so centring it in 300px scrolls to 100.
		expect(targets[targets.length - 1]).toBe(100);
	});

	it("stops touching the track once a listener destroys it", async () => {
		const { track, instance } = setup(3, {
			attributes: 'data-carousel--autoplay="1000"',
			extra: `<button data-carousel--action="toggle">Pause</button>`,
		});
		instance.subscribe((state) => {
			if (!state.playing) instance.destroy();
		});
		instance.next();
		await frame();
		expect(track.style.getPropertyValue("scroll-snap-type")).toBe("");
		expect(track.hasAttribute("style")).toBe(false);
	});

	it("leaves a handed over control's state to the carousel it now operates", () => {
		document.body.innerHTML = `${snapStyles}
			<section data-carousel aria-label="A" id="a">
				<div data-carousel--track class="track" id="a-track">
					<div class="slide">1</div><div class="slide">2</div>
				</div>
				<button id="prev" data-carousel--action="prev">Previous</button>
			</section>
			<section data-carousel aria-label="B" id="b">
				<div data-carousel--track class="track" id="b-track">
					<div class="slide">1</div><div class="slide">2</div>
				</div>
			</section>`;
		fakeLayout($("#a-track"), { size: 400, slide: 400 });
		fakeLayout($("#b-track"), { size: 400, slide: 400 });
		carousel.init();
		$("#prev").setAttribute("aria-controls", "b-track");
		carousel.refresh();
		expect($("#prev").getAttribute("aria-disabled")).toBe("true");
		carousel.get("a")?.destroy();
		expect($("#prev").getAttribute("aria-disabled")).toBe("true");
		expect($("#prev").getAttribute("aria-controls")).toBe("b-track");
	});

	it("lets a toggle inside the track stop autoplay with a click", () => {
		document.body.innerHTML = `${snapStyles}
			<section data-carousel aria-label="Hero" data-carousel--autoplay="1000">
				<div data-carousel--track class="track">
					<div class="slide"><button id="toggle" data-carousel--action="toggle">Pause</button></div>
					<div class="slide">2</div>
				</div>
			</section>`;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		const toggle = $("#toggle");
		toggle.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
		);
		toggle.click();
		expect(carousel.get(toggle)?.state.playing).toBe(false);
	});

	it("warns when autoplay only has a play control", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		setup(3, {
			attributes: 'data-carousel--autoplay="1000"',
			extra: `<button data-carousel--action="play">Play</button>`,
		});
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('no data-carousel--action="toggle"'),
		);
	});

	it("passes focus inside a rebuilt marker to its replacement", () => {
		const { instance } = setup(3, {
			extra: `<ol data-carousel--markers><template><li><button class="dot">Dot {n}</button></li></template></ol>`,
		});
		$$(".dot")[1]?.focus();
		$<HTMLTemplateElement>("template").innerHTML =
			`<li><button class="dot">Slide {n}</button></li>`;
		instance.refresh();
		expect(document.activeElement?.textContent).toBe("Slide 2");
	});

	it("hands a control over cleanly whichever carousel refreshes first", () => {
		document.body.innerHTML = `${snapStyles}
			<section data-carousel aria-label="B" id="b">
				<div data-carousel--track class="track" id="b-track">
					<div class="slide">1</div><div class="slide">2</div>
				</div>
			</section>
			<section data-carousel aria-label="A" id="a">
				<div data-carousel--track class="track" id="a-track">
					<div class="slide">1</div><div class="slide">2</div>
				</div>
				<form><button id="prev" data-carousel--action="prev">Previous</button></form>
			</section>`;
		fakeLayout($("#a-track"), { size: 400, slide: 400 });
		fakeLayout($("#b-track"), { size: 400, slide: 400 });
		carousel.init();
		$("#prev").setAttribute("aria-controls", "b-track");
		carousel.refresh();
		expect($("#prev").getAttribute("type")).toBe("button");
		expect($("#prev").getAttribute("aria-disabled")).toBe("true");
		carousel.get("b")?.goTo(1);
		carousel.get("b")?.destroy();
		expect($("#prev").hasAttribute("aria-disabled")).toBe(false);
		expect($("#prev").hasAttribute("type")).toBe(false);
	});

	it("plans loop rotations with each slide's own margins", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `
			<style>
				.track { display: flex; scroll-snap-type: x mandatory; }
				.slide { scroll-snap-align: start; }
				#slide-0 { margin-right: 180px; }
			</style>
			${carouselMarkup(4, { attributes: "data-carousel--loop" })}`;
		const track = $(".track");
		fakeLayout(track, { size: 480, slide: 100 });
		carousel.init();
		const instance = carousel.get(track);
		const seen: number[] = [];
		for (let i = 0; i < 3; i++) {
			$("#next").click();
			await frame();
			seen.push(instance?.state.index ?? -1);
		}
		expect(seen[0]).not.toBe(0);
	});

	it("lets a tap on a toggle inside the track stop autoplay", () => {
		document.body.innerHTML = `${snapStyles}
			<section data-carousel aria-label="Hero" data-carousel--autoplay="1000">
				<div data-carousel--track class="track">
					<div class="slide"><button id="toggle" data-carousel--action="toggle">Pause</button></div>
					<div class="slide">2</div>
				</div>
			</section>`;
		fakeLayout($(".track"), { size: 400, slide: 400 });
		carousel.init();
		const toggle = $("#toggle");
		toggle.dispatchEvent(new Event("touchstart", { bubbles: true }));
		toggle.dispatchEvent(new Event("touchend", { bubbles: true }));
		toggle.click();
		expect(carousel.get(toggle)?.state.playing).toBe(false);
	});

	it("jumps to a looping marker it can't scroll to", async () => {
		const { instance } = setup(
			4,
			{
				attributes: "data-carousel--loop",
				extra: `<div data-carousel--markers><template><button class="dot">{n}</button></template></div>`,
			},
			{ size: 300, slide: 100 },
		);
		$$(".dot")[2]?.click();
		await frame();
		expect(instance.state.index).toBe(2);
		expect($("#slide-2").hasAttribute("data-carousel--active")).toBe(true);
	});

	it("keeps a marker heading for its own slide when the pages change", () => {
		const { track, instance } = setup(
			4,
			{ extra: `<button id="last" data-carousel--marker="3">Last</button>` },
			{ size: 300, slide: 100 },
		);
		const targets = holdScrolls(track);
		$("#last").click();
		expect(targets).toEqual([100]);
		fakeLayout(track, { size: 100, slide: 100 });
		holdScrolls(track);
		const after = holdScrolls(track);
		instance.refresh();
		expect(after[after.length - 1]).toBe(300);
	});

	it("doesn't add markers or dispatch events once a listener destroys it", () => {
		const { root, instance } = setup(3, {
			attributes: 'data-carousel--autoplay="1000"',
			extra: `<button data-carousel--action="toggle">Pause</button>
				<div id="first" data-carousel--markers><template><button class="dot">{n}</button></template></div>
				<div id="second" data-carousel--markers><template><button class="pill">{n}</button></template></div>`,
		});
		const events: unknown[] = [];
		root.addEventListener("carousel-change", (event) => events.push(event));
		// Focus stops autoplay, so it is started again with focus still on the marker.
		$$(".dot")[0]?.focus();
		instance.play();
		let destroyedDuringRefresh = false;
		instance.subscribe((state) => {
			if (state.playing) return;
			destroyedDuringRefresh = true;
			instance.destroy();
		});
		for (const template of $$<HTMLTemplateElement>("template"))
			template.innerHTML = template.innerHTML.replace("{n}", "#{n}");
		instance.refresh();
		expect(destroyedDuringRefresh).toBe(true);
		expect(root.hasAttribute("data-carousel--ready")).toBe(false);
		expect($$(".pill")).toHaveLength(0);
		expect($$(".dot")).toHaveLength(0);
		expect(events).toHaveLength(0);
	});

	it("leaves important inline styles and a rewinding carousel's own order alone", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.innerHTML = `
			<style>
				.track { display: flex; scroll-snap-type: x mandatory; scroll-padding-left: 20px; }
				.slide { scroll-snap-align: start; }
			</style>
			${carouselMarkup(4, { attributes: "data-carousel--loop" })}`;
		$("#slide-0").style.setProperty("order", "-5", "important");
		fakeLayout($(".track"), { size: 300, slide: 100 });
		carousel.init();
		expect($("#slide-0").style.getPropertyValue("order")).toBe("-5");
		const root = $("[data-carousel]");
		root.style.setProperty("--carousel-index", "0", "important");
		carousel.destroy();
		expect(root.style.getPropertyValue("--carousel-index")).toBe("0");
		expect(root.style.getPropertyPriority("--carousel-index")).toBe(
			"important",
		);
	});

	it("drops what it wrote for a control's old action", () => {
		const { instance } = setup(3);
		const prev = $("#prev");
		expect(prev.getAttribute("aria-disabled")).toBe("true");
		prev.setAttribute("data-carousel--action", "toggle");
		prev.textContent = "";
		instance.refresh();
		expect(prev.hasAttribute("aria-disabled")).toBe(false);
		expect(prev.getAttribute("aria-label")).toBe("Start automatic slide show");
	});

	it("focuses the first enabled control inside a rebuilt marker", () => {
		const { instance } = setup(3, {
			extra: `<ol data-carousel--markers><template><li><button disabled>Off</button><button class="go">Go {n}</button></li></template></ol>`,
		});
		$$(".go")[2]?.focus();
		$<HTMLTemplateElement>("template").innerHTML =
			`<li><button disabled>Off</button><button class="go">Show {n}</button></li>`;
		instance.refresh();
		expect(document.activeElement?.textContent).toBe("Show 3");
	});

	it("stays on the same slide when the track is resized", async () => {
		document.body.innerHTML = snapStyles + carouselMarkup(4);
		const track = $(".track");
		const layout = { size: 400, slide: 400 };
		fakeLayout(track, layout);
		carousel.init();
		const instance = carousel.get(track);
		instance?.goTo(2);
		await frame();
		expect(scrollOf(track)).toBe(800);
		// The track narrows, and the scroll position stays at 800, which is now the last slide.
		layout.size = 200;
		layout.slide = 200;
		await resize();
		expect(scrollOf(track)).toBe(400);
		expect(instance?.state.index).toBe(2);
	});

	it("stays on the same slide when the browser snaps a resized track before it is measured again", async () => {
		document.body.innerHTML = snapStyles + carouselMarkup(4);
		const track = $(".track");
		const layout = { size: 400, slide: 400 };
		fakeLayout(track, layout);
		carousel.init();
		const instance = carousel.get(track);
		const changes: number[] = [];
		$("[data-carousel]").addEventListener("carousel-change", (event) => {
			changes.push((event as CustomEvent<{ index: number }>).detail.index);
		});
		instance?.goTo(2);
		await frame();
		changes.length = 0;
		// The track narrows, and the browser snaps it to the same slide, scrolling before the next frame's measure.
		layout.size = 200;
		layout.slide = 200;
		const { resizeObservers } = await import("./setup.js");
		for (const notify of resizeObservers) notify();
		track.scrollLeft = 400;
		await frame();
		expect(scrollOf(track)).toBe(400);
		expect(instance?.state.index).toBe(2);
		expect(changes).toEqual([]);
	});

	it("drops the slide semantics when a slide's role changes", () => {
		const { instance } = setup(2);
		const slide = $("#slide-0");
		slide.setAttribute("role", "button");
		instance.refresh();
		expect(slide.hasAttribute("aria-roledescription")).toBe(false);
		expect(slide.hasAttribute("aria-label")).toBe(false);
	});

	it("keeps a role the application changed after the library set it", () => {
		const { instance } = setup(2);
		const slide = $("#slide-0");
		expect(slide.getAttribute("role")).toBe("group");
		slide.setAttribute("role", "button");
		instance.refresh();
		expect(slide.getAttribute("role")).toBe("button");
		carousel.destroy();
		expect(slide.getAttribute("role")).toBe("button");
	});
});
