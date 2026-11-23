import results from "../../../../packages/benchmarks/results/catalyst.json";

/** The latest Catalyst benchmark run, written by `npm run bench`. */
export const benchmarks = results;

export type BenchmarkLibrary = (typeof results.libraries)[number];

const libraries = new Map(
	results.libraries.map((library) => [library.id, library]),
);

export const libraryFor = (id: string): BenchmarkLibrary => {
	const library = libraries.get(id);
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

/** A bar's width, so the fastest library fills it and longer bars are faster. */
export const barWidth = (relative: number) => `${(100 / relative).toFixed(1)}%`;
