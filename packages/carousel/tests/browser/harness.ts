import { fileURLToPath } from "node:url";
import {
	type Browser,
	type BrowserContextOptions,
	chromium,
	firefox,
	type Page,
	webkit,
} from "playwright";
import { build } from "vite-plus";

/**
 * Runs the carousel in Chromium, Firefox and WebKit, which happy-dom can't
 * stand in for: it doesn't lay out, scroll or snap. Each test opens a fixture
 * page with `setContent`, so no server is needed.
 */

export const engines = { chromium, firefox, webkit } as const;
export type Engine = keyof typeof engines;

const entry = fileURLToPath(new URL("./entry.ts", import.meta.url));

let bundle: Promise<string> | undefined;

/** The library as one script, which sets `window.Lucid` */
const library = () => {
	bundle ??= build({
		configFile: false,
		logLevel: "silent",
		define: { __DEV__: "true" },
		build: {
			write: false,
			minify: false,
			lib: { entry, formats: ["iife"], name: "Lucid" },
		},
	}).then((result) => {
		const outputs = Array.isArray(result) ? result : [result];
		for (const output of outputs) {
			if (!("output" in output)) continue;
			const chunk = output.output.find((file) => file.type === "chunk");
			if (chunk && chunk.type === "chunk") return chunk.code;
		}
		throw new Error("The browser test bundle has no code");
	});
	return bundle;
};

/** The CSS from the README, with the sizes the fixtures need */
const BASE_CSS = `
	* { box-sizing: border-box; }
	body { margin: 0; font: 14px/1 sans-serif; }
	[data-carousel] { width: var(--carousel-width, 600px); }
	.track {
		display: flex;
		gap: var(--gap, 0px);
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.track::-webkit-scrollbar { display: none; }
	.track > * {
		flex: 0 0 var(--w, 100%);
		height: 100px;
		scroll-snap-align: var(--align, start);
		background: #ddd;
	}
	.smooth .track { scroll-behavior: smooth; }
	.vertical .track {
		flex-direction: column;
		height: 300px;
		overflow: hidden auto;
		scroll-snap-type: y mandatory;
	}
	.vertical .track > * { height: auto; flex: 0 0 var(--w, 100%); }
`;

export type Fixture = {
	/** Number of slides, or each slide's width */
	slides: number | string[];
	/** Attributes for the `data-carousel` element, such as `data-carousel--loop` */
	attributes?: string;
	/** Classes for the `data-carousel` element, such as `smooth` or `vertical` */
	classes?: string;
	/** CSS custom properties for the carousel, such as `--w: 50%` */
	style?: string;
	/** Extra CSS */
	css?: string;
	markers?: boolean;
	status?: boolean;
	/** Extra markup inside the carousel, after the controls */
	extra?: string;
	/** Markup inside each slide */
	content?: (index: number) => string;
	dir?: "rtl";
	/** Leave out `carousel.init()`, for tests that set up first */
	init?: boolean;
	/** Options passed to `carousel.init()`, as a JavaScript expression */
	options?: string;
};

const slideMarkup = (fixture: Fixture) => {
	const widths =
		typeof fixture.slides === "number"
			? Array.from({ length: fixture.slides }, () => null)
			: fixture.slides;
	return widths
		.map((width, index) => {
			const style = width === null ? "" : ` style="--w: ${width}"`;
			const content = fixture.content?.(index) ?? String(index);
			return `<li id="slide-${index}" data-slide="${index}"${style}>${content}</li>`;
		})
		.join("");
};

export const markup = (fixture: Fixture) => `
	<section
		id="carousel"
		data-carousel
		aria-label="Test slides"
		class="${fixture.classes ?? ""}"
		style="${fixture.style ?? ""}"
		${fixture.dir ? `dir="${fixture.dir}"` : ""}
		${fixture.attributes ?? ""}
	>
		<ul data-carousel--track class="track" id="track">${slideMarkup(fixture)}</ul>
		<button data-carousel--action="prev" id="prev">Previous</button>
		<button data-carousel--action="next" id="next">Next</button>
		${fixture.markers ? `<div data-carousel--markers id="markers"><template><button class="marker">{n}</button></template></div>` : ""}
		${fixture.status ? `<p data-carousel--status id="status"></p>` : ""}
		${fixture.extra ?? ""}
	</section>
`;

export type Opened = {
	page: Page;
	/** Errors and warnings the page logged */
	messages: string[];
	close: () => Promise<void>;
};

/** Opens a fixture in a new context and starts the carousel */
export const open = async (
	browser: Browser,
	fixture: Fixture,
	context: BrowserContextOptions = {},
): Promise<Opened> => {
	const ctx = await browser.newContext({
		viewport: { width: 800, height: 600 },
		reducedMotion: "no-preference",
		...context,
	});
	const page = await ctx.newPage();
	const messages: string[] = [];
	page.on("pageerror", (error) => messages.push(`error: ${error.message}`));
	page.on("console", (message) => {
		if (message.type() === "error" || message.type() === "warning")
			messages.push(`${message.type()}: ${message.text()}`);
	});
	await page.setContent(
		`<!doctype html><html><head><style>${BASE_CSS}${fixture.css ?? ""}</style></head><body>${markup(fixture)}</body></html>`,
	);
	await page.addScriptTag({ content: await library() });
	if (fixture.init !== false) {
		await page.evaluate(
			`window.Lucid.carousel.init({ drag: window.Lucid.drag, ...${fixture.options ?? "{}"} })`,
		);
		await settle(page);
	}
	return { page, messages, close: () => ctx.close() };
};

/** Waits until the track has stopped scrolling and the carousel has settled */
export const settle = (page: Page, quiet = 350) =>
	page.evaluate(
		(quiet) =>
			new Promise<void>((resolve) => {
				const track = document.querySelector<HTMLElement>(
					"[data-carousel--track]",
				);
				if (!track) return resolve();
				let last = "";
				let since = performance.now();
				const tick = () => {
					const now = `${track.scrollLeft},${track.scrollTop},${document.querySelector("[data-carousel]")?.getAttribute("data-carousel--index")}`;
					if (now !== last) {
						last = now;
						since = performance.now();
					}
					if (performance.now() - since >= quiet) resolve();
					else requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			}),
		quiet,
	);

export type Snapshot = {
	index: number;
	count: number;
	atStart: boolean;
	atEnd: boolean;
	scrollable: boolean;
	playing: boolean;
	/** `scrollLeft` or `scrollTop`, rounded */
	scroll: number;
	/** The furthest the track can scroll, rounded */
	max: number;
	/** The DOM index of the slide snapped into place, measured from the page rather than the library */
	shown: number;
	/** The DOM indexes of the slides with `data-carousel--active` */
	active: number[];
	/** Each slide's CSS `order`, as the library set it */
	order: string[];
	slides: number;
};

/**
 * The carousel's state, and which slide is snapped into place, measured from
 * the page: the slide whose snap point, from its `scroll-snap-align`, is
 * nearest the track's own
 */
export const snapshot = (page: Page) =>
	page.evaluate((): Snapshot => {
		const root = document.querySelector<HTMLElement>("[data-carousel]");
		const track = document.querySelector<HTMLElement>("[data-carousel--track]");
		if (!root || !track) throw new Error("No carousel on the page");
		const lucid = (
			window as unknown as {
				Lucid: {
					carousel: {
						get: (e: Element) =>
							| {
									state: Omit<
										Snapshot,
										"scroll" | "max" | "shown" | "active" | "order" | "slides"
									>;
							  }
							| undefined;
					};
				};
			}
		).Lucid;
		const api = lucid.carousel.get(root);
		const style = getComputedStyle(track);
		const vertical = /\b(y|block)\b/.test(style.scrollSnapType);
		const rtl = style.direction === "rtl";
		const view = track.getBoundingClientRect();
		const padStart =
			Number.parseFloat(
				vertical
					? style.scrollPaddingTop
					: rtl
						? style.scrollPaddingRight
						: style.scrollPaddingLeft,
			) || 0;
		const padEnd =
			Number.parseFloat(
				vertical
					? style.scrollPaddingBottom
					: rtl
						? style.scrollPaddingLeft
						: style.scrollPaddingRight,
			) || 0;
		const slides = Array.from(track.children) as HTMLElement[];
		let shown = -1;
		let best = Number.POSITIVE_INFINITY;
		slides.forEach((slide, index) => {
			const box = slide.getBoundingClientRect();
			const align = getComputedStyle(slide).scrollSnapAlign.split(" ").pop();
			const start = vertical
				? box.top - view.top
				: rtl
					? view.right - box.right
					: box.left - view.left;
			const size = vertical ? box.height : box.width;
			const client = vertical ? track.clientHeight : track.clientWidth;
			const distance =
				align === "center"
					? Math.abs(
							start + size / 2 - (padStart + (client - padStart - padEnd) / 2),
						)
					: align === "end"
						? Math.abs(start + size - (client - padEnd))
						: Math.abs(start - padStart);
			if (distance < best - 0.5) {
				best = distance;
				shown = index;
			}
		});
		const scroll = vertical ? track.scrollTop : Math.abs(track.scrollLeft);
		const max = vertical
			? track.scrollHeight - track.clientHeight
			: track.scrollWidth - track.clientWidth;
		return {
			...(api?.state ?? {
				index: -1,
				count: 0,
				atStart: false,
				atEnd: false,
				scrollable: false,
				playing: false,
			}),
			scroll: Math.round(scroll),
			max: Math.round(max),
			shown,
			active: slides.flatMap((slide, index) =>
				slide.hasAttribute("data-carousel--active") ? [index] : [],
			),
			order: slides.map((slide) => slide.style.order),
			slides: slides.length,
		};
	});

/**
 * Clicks an element and waits for the carousel to settle. `force` clicks
 * controls with `aria-disabled`, which Playwright otherwise waits on.
 */
export const click = async (page: Page, selector: string, force = false) => {
	await page.click(selector, { force });
	await settle(page);
};

/** Calls a method of the carousel's API, such as `goTo(3)`, and waits for it to settle */
export const call = async (page: Page, method: string) => {
	await page.evaluate(
		`window.Lucid.carousel.get(document.getElementById("carousel")).${method}`,
	);
	await settle(page);
};

/**
 * The scroll positions each page should snap to, worked out from the slides'
 * boxes before anything scrolls: each slide's start, clamped to what the track
 * can reach, with repeats merged. Only for start aligned tracks without
 * padding.
 */
export const startPositions = (page: Page) =>
	page.evaluate(() => {
		const track = document.querySelector<HTMLElement>("[data-carousel--track]");
		if (!track) return [];
		const view = track.getBoundingClientRect();
		const max = track.scrollWidth - track.clientWidth;
		const positions: number[] = [];
		for (const slide of Array.from(track.children)) {
			const start = Math.round(
				Math.min(
					slide.getBoundingClientRect().left - view.left + track.scrollLeft,
					max,
				),
			);
			if (positions.at(-1) !== start) positions.push(start);
		}
		return positions;
	});

/** Drags the track with the mouse by `dx` pixels over `steps` moves */
export const drag = async (
	page: Page,
	dx: number,
	{ steps = 10, delay = 16 }: { steps?: number; delay?: number } = {},
) => {
	const box = await page.locator("#track").boundingBox();
	if (!box) throw new Error("No track to drag");
	const y = box.y + box.height / 2;
	// Starts near the edge the drag moves away from, so the pointer stays in the window.
	const x = box.x + (dx < 0 ? box.width * 0.9 : box.width * 0.1);
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let step = 1; step <= steps; step++) {
		await page.mouse.move(x + (dx * step) / steps, y);
		if (delay) await page.waitForTimeout(delay);
	}
	await page.mouse.up();
	await settle(page);
};

/** Chromium runs as the full browser in its new headless mode, as the benchmarks do */
export const launch = (engine: Engine) =>
	engines[engine].launch(engine === "chromium" ? { channel: "chromium" } : {});
