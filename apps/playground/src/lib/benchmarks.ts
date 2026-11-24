import carousel from "../../../../packages/benchmarks/results/carousel.json";
import results from "../../../../packages/benchmarks/results/catalyst.json";

/** The latest Catalyst benchmark run, written by `npm run bench`. */
export const benchmarks = results;

type CarouselRun = typeof carousel;
type CarouselScenario = CarouselRun["scenarios"][number];

/**
 * A library's result in a scenario. `note` says why it failed the scenario's
 * check, and is left out of the JSON when every library passes, so it's typed
 * here rather than inferred.
 */
export type CarouselResult = CarouselScenario["results"][number] & {
	note?: string;
};

/** The latest carousel benchmark run, written by `npm run bench:carousel`. */
export const carouselBenchmarks = carousel as Omit<CarouselRun, "scenarios"> & {
	scenarios: Array<
		Omit<CarouselScenario, "results"> & { results: CarouselResult[] }
	>;
};

export type BenchmarkLibrary = {
	id: string;
	name: string;
	version: string | null;
	homepage: string | null;
	/** How the library works, such as "CSS scroll snap". */
	kind?: string;
};

/** A library from a run's results. Defaults to the Catalyst run. */
export const libraryFor = (
	id: string,
	libraries: BenchmarkLibrary[] = results.libraries,
): BenchmarkLibrary => {
	const library = libraries.find((item) => item.id === id);
	if (!library)
		throw new Error(`The benchmark results have no library "${id}"`);
	return library;
};

const format = (value: number, options: Intl.NumberFormatOptions) =>
	new Intl.NumberFormat("en-GB", options).format(value);

export const formatMs = (ms: number) =>
	`${format(ms, { maximumSignificantDigits: 3 })} ms`;

/** How many times slower than the fastest, or "Fastest". */
export const formatRelative = (relative: number) =>
	relative === 1
		? "Fastest"
		: `${format(relative, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;

export const formatKb = (bytes: number) =>
	`${format(bytes / 1024, { maximumFractionDigits: 1 })} kB`;

export const formatMb = (mb: number) =>
	`${format(mb, { maximumFractionDigits: 1 })} MB`;

export const formatDate = (date: string) =>
	new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
		new Date(date),
	);

/**
 * A bar's width, so the fastest library fills it and longer bars are faster.
 * A library that failed a scenario's check can be faster than the fastest that
 * passed, and fills it too.
 */
export const barWidth = (relative: number) =>
	`${Math.min(100, 100 / relative).toFixed(1)}%`;
