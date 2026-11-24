/**
 * The activity log shown on every page. It is plain DOM code rather than a
 * Catalyst store, so it keeps working while a page tests `destroy()` or a
 * store that throws.
 *
 * Library warnings and errors are mirrored from the console, so scenarios that
 * test a warning show it on the page.
 */

export type LogLevel = "info" | "success" | "warn" | "error" | "debug";

type Entry = {
	time: Date;
	source: string;
	level: LogLevel;
	message: string;
	data?: unknown;
	hasData: boolean;
};

const MAX_ENTRIES = 250;
const MAX_DATA_LENGTH = 1600;

const LIBRARY_PREFIXES: Array<[prefix: string, source: string]> = [
	["[Catalyst]", "catalyst"],
	["[Cookie Controller]", "cookie-controller"],
	["[Carousel]", "carousel"],
	["[Forms]", "forms"],
];

const original = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console),
};

// --------------------------------------------------------
// Formatting

const describeElement = (element: Element) => {
	const id = element.id ? `#${element.id}` : "";
	const name = element.getAttribute("name");
	return `<${element.localName}${id}${name ? ` name="${name}"` : ""}>`;
};

const describeEvent = (event: Event) => {
	const target = event.currentTarget ?? event.target;
	const on =
		target instanceof Element
			? ` on ${describeElement(target)}`
			: target === document
				? " on document"
				: target === window
					? " on window"
					: "";
	return `${event.type} event${on}`;
};

// JSON has no undefined, so it is written as a marker and unquoted afterwards.
const UNDEFINED = "\u0000undefined";

const replacer = (_key: string, value: unknown) => {
	if (value instanceof Event) return describeEvent(value);
	if (value instanceof Element) return describeElement(value);
	if (value instanceof Error) return `${value.name}: ${value.message}`;
	if (value instanceof Map) return Object.fromEntries(value);
	if (value instanceof Set) return Array.from(value);
	if (typeof value === "function") return `ƒ ${value.name || "anonymous"}()`;
	if (value === undefined) return UNDEFINED;
	return value;
};

/** Text for values JSON can't represent, such as symbols, bigints and cycles. */
const fallbackText = (value: unknown) =>
	typeof value === "symbol" || typeof value === "bigint"
		? value.toString()
		: Object.prototype.toString.call(value);

export const formatData = (value: unknown): string => {
	if (typeof value === "string") return value;
	if (value === undefined) return "undefined";
	if (value instanceof Event) return describeEvent(value);
	if (value instanceof Element) return describeElement(value);
	if (value instanceof Error) return `${value.name}: ${value.message}`;
	try {
		const text = (
			JSON.stringify(value, replacer, 2) ?? fallbackText(value)
		).replaceAll(JSON.stringify(UNDEFINED), "undefined");
		return text.length > MAX_DATA_LENGTH
			? `${text.slice(0, MAX_DATA_LENGTH)}\n…`
			: text;
	} catch {
		return fallbackText(value);
	}
};

const formatTime = (time: Date) =>
	`${time.toLocaleTimeString("en-GB", { hour12: false })}.${String(time.getMilliseconds()).padStart(3, "0")}`;

// --------------------------------------------------------
// Rendering

const LEVEL_STYLES: Record<LogLevel, { dot: string; text: string }> = {
	info: { dot: "bg-sky-400", text: "text-fg" },
	success: { dot: "bg-emerald-400", text: "text-fg" },
	warn: { dot: "bg-amber-400", text: "text-amber-100" },
	error: { dot: "bg-rose-400", text: "text-rose-100" },
	debug: { dot: "bg-subtle", text: "text-muted" },
};

const entries: Entry[] = [];

const getList = () =>
	document.querySelector<HTMLOListElement>("[data-log-list]");

const renderEntry = (entry: Entry) => {
	const style = LEVEL_STYLES[entry.level];
	const item = document.createElement("li");
	item.dataset.level = entry.level;
	item.className =
		"border-b border-line/60 px-4 py-2.5 data-[level=debug]:hidden group-data-[debug=true]/log:data-[level=debug]:block";

	const meta = document.createElement("div");
	meta.className = "flex items-center gap-2 text-[11px] leading-4";
	const dot = document.createElement("span");
	dot.className = `size-1.5 shrink-0 rounded-full ${style.dot}`;
	const source = document.createElement("span");
	source.className = "font-medium text-muted";
	source.textContent = entry.source;
	const time = document.createElement("time");
	time.className = "ml-auto font-mono text-subtle tabular-nums";
	time.textContent = formatTime(entry.time);
	meta.append(dot, source, time);

	const message = document.createElement("p");
	message.className = `mt-1 text-[13px] leading-5 break-words ${style.text}`;
	message.textContent = entry.message;
	item.append(meta, message);

	if (entry.hasData) {
		const data = document.createElement("pre");
		data.className =
			"mt-1.5 max-h-48 overflow-auto rounded border border-line/70 bg-canvas px-2 py-1.5 font-mono text-[11px] leading-4 whitespace-pre-wrap break-words text-muted";
		data.textContent = formatData(entry.data);
		item.append(data);
	}
	return item;
};

const updateCounts = () => {
	const visible = entries.filter((entry) => entry.level !== "debug").length;
	for (const element of document.querySelectorAll("[data-log-count]")) {
		element.textContent = String(visible);
	}
	const latest = entries.findLast((entry) => entry.level !== "debug");
	for (const element of document.querySelectorAll("[data-log-latest]")) {
		element.textContent = latest
			? `${latest.source}: ${latest.message}`
			: "Nothing logged yet";
	}
	// Debug entries only count while the Debug toggle shows them.
	const showsDebug =
		document.querySelector<HTMLElement>("[data-log-panel]")?.dataset.debug ===
		"true";
	const empty = document.querySelector("[data-log-empty]");
	if (empty) {
		empty.toggleAttribute(
			"hidden",
			(showsDebug ? entries.length : visible) > 0,
		);
	}
};

/** Re-renders the count and empty message, after the Debug toggle changes. */
export const refreshLogSummary = () => updateCounts();

const push = (entry: Omit<Entry, "time">) => {
	const full: Entry = { ...entry, time: new Date() };
	entries.push(full);
	if (entries.length > MAX_ENTRIES) entries.shift();

	const list = getList();
	if (list) {
		list.prepend(renderEntry(full));
		while (list.children.length > MAX_ENTRIES) list.lastElementChild?.remove();
	}
	updateCounts();
};

export const clearLog = () => {
	entries.length = 0;
	getList()?.replaceChildren();
	updateCounts();
};

// --------------------------------------------------------
// Public API

export type Logger = Record<
	Exclude<LogLevel, "debug">,
	(message: string, data?: unknown) => void
>;

/**
 * Creates a logger for one source, usually a store or scenario name. Entries
 * also go to the browser console, so objects can be inspected there.
 */
export const createLogger = (source: string): Logger => {
	const write =
		(level: LogLevel) =>
		(message: string, ...rest: [data?: unknown]) => {
			const hasData = rest.length > 0;
			const consoleArgs = hasData ? [rest[0]] : [];
			if (level === "warn")
				original.warn(`[${source}] ${message}`, ...consoleArgs);
			else if (level === "error")
				original.error(`[${source}] ${message}`, ...consoleArgs);
			else original.log(`[${source}] ${message}`, ...consoleArgs);
			push({ source, level, message, data: rest[0], hasData });
		};
	return {
		info: write("info"),
		success: write("success"),
		warn: write("warn"),
		error: write("error"),
	};
};

// --------------------------------------------------------
// Console mirroring

const mirror = (level: LogLevel, args: unknown[], prefixedOnly: boolean) => {
	const [first, ...rest] = args;
	if (typeof first === "string") {
		const library = LIBRARY_PREFIXES.find(([prefix]) =>
			first.startsWith(prefix),
		);
		if (library) {
			push({
				source: library[1],
				level,
				message: first.slice(library[0].length).trim(),
				data: rest[0],
				hasData: rest.length > 0,
			});
			return;
		}
	}
	if (prefixedOnly) return;
	push({
		source: "console",
		level,
		message:
			first instanceof Error
				? `${first.name}: ${first.message}`
				: formatData(first),
		data: rest[0],
		hasData: rest.length > 0,
	});
};

declare global {
	interface Window {
		__playgroundConsole?: boolean;
	}
}

if (!window.__playgroundConsole) {
	window.__playgroundConsole = true;
	console.warn = (...args: unknown[]) => {
		original.warn(...args);
		mirror("warn", args, false);
	};
	console.error = (...args: unknown[]) => {
		original.error(...args);
		mirror("error", args, false);
	};
	console.debug = (...args: unknown[]) => {
		original.debug(...args);
		mirror("debug", args, true);
	};
	window.addEventListener("error", (event) => {
		push({
			source: "uncaught",
			level: "error",
			message: event.message,
			hasData: false,
		});
	});
	window.addEventListener("unhandledrejection", (event) => {
		push({
			source: "unhandled rejection",
			level: "error",
			message: formatData(event.reason),
			hasData: false,
		});
	});
}
