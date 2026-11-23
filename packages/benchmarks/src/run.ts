/**
 * Runs a benchmark suite in Chromium and writes `results/{suite}.json`.
 *
 * node src/run.ts catalyst                   build the pages, check every library's output, benchmark them all and write the results
 * node src/run.ts catalyst --check           only check that every library renders the same DOM as the first
 * node src/run.ts catalyst --library alpine  check and benchmark the suite's library and Alpine, without writing the results
 * node src/run.ts catalyst --samples 5       take fewer samples, for a quick look
 * node src/run.ts catalyst --throttle 4      slow the CPU down 4 times, as on a mid-range phone
 *
 * Every sample opens its page in a fresh browser context.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { launch, open } from "./browser.ts";
import { build, root } from "./build.ts";
import { difference, snapshot } from "./compare.ts";
import {
	describeEnvironment,
	gitCommit,
	packageVersion,
} from "./environment.ts";
import { perform, time } from "./measure.ts";
import { serve } from "./server.ts";
import { measureSize } from "./size.ts";
import { geometricMean, median, summarise } from "./stats.ts";
import type { Library, Scenario, Suite } from "./suite.ts";

const dist = join(root, "dist");

/** How many times each scenario's warm-up steps run before timing. */
const WARMUPS = 5;
/** Fresh pages measured per library for the heap size. */
const MEMORY_SAMPLES = 5;

const { values: args, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		check: { type: "boolean", default: false },
		library: { type: "string", multiple: true },
		samples: { type: "string", default: "15" },
		throttle: { type: "string", default: "1" },
	},
});

const samples = Number(args.samples);
const throttle = Number(args.throttle);
const suiteId = positionals[0];
if (!suiteId) throw new Error("Name a suite to run, such as `catalyst`.");

const suite: Suite = (await import(`./${suiteId}/index.ts`)).default;
const unknown = args.library?.filter(
	(id) => !suite.libraries.some((library) => library.id === id),
);
if (unknown?.length) throw new Error(`Unknown library: ${unknown.join(", ")}`);
const selected = args.library
	? suite.libraries.filter(
			(library, index) => index === 0 || args.library?.includes(library.id),
		)
	: suite.libraries;

console.log("Building pages…");
build(dist);

const server = await serve(dist);
const browser = await launch();

const pageUrl = (library: Library, page: string) =>
	`${server.origin}/${suite.id}/pages/${library.id}/${page}.html`;

/** Opens the scenario's page, warms it up and sets it up for the timed step. */
const prepare = async (library: Library, scenario: Scenario) => {
	const session = await open(
		browser,
		pageUrl(library, scenario.page),
		throttle,
	);
	try {
		for (let round = 0; round < WARMUPS; round++) {
			for (const step of scenario.warmup) await perform(session.page, step);
		}
		for (const step of scenario.setup) await perform(session.page, step);
	} catch (error) {
		await session.close();
		throw error;
	}
	return session;
};

/** Runs every scenario once per library and checks the DOM matches the first library's. */
const check = async () => {
	const problems: string[] = [];
	for (const scenario of suite.scenarios) {
		let expected: string | undefined;
		for (const library of selected) {
			const label = `${scenario.id} / ${library.id}`;
			try {
				const session = await prepare(library, scenario);
				try {
					await perform(session.page, scenario.timed);
					for (const step of scenario.check ?? []) {
						await perform(session.page, step);
					}
					const html = await snapshot(session.page, suite.root);
					expected ??= html;
					const diff = difference(expected, html);
					if (diff) problems.push(`${label}:\n${diff}`);
					if (session.messages.length) {
						problems.push(`${label} logged:\n${session.messages.join("\n")}`);
					}
				} finally {
					await session.close();
				}
			} catch (error) {
				problems.push(`${label}: ${String(error)}`);
			}
		}
	}
	return problems;
};

/** Times every scenario for every library, `samples` times each. */
const measure = async () => {
	const times = new Map<string, number[]>();
	for (let round = 0; round < samples; round++) {
		console.log(`Round ${round + 1} of ${samples}`);
		// Libraries take turns in a different order each round, so a change in
		// the machine's speed during the run doesn't favour one of them.
		const shift = round % selected.length;
		const order = [...selected.slice(shift), ...selected.slice(0, shift)];
		for (const scenario of suite.scenarios) {
			for (const library of order) {
				const session = await prepare(library, scenario);
				try {
					const key = `${scenario.id}/${library.id}`;
					const ms = await time(session.page, scenario.timed);
					times.set(key, [...(times.get(key) ?? []), ms]);
				} finally {
					await session.close();
				}
			}
		}
	}
	return times;
};

/** The median heap size when the memory page loads, and after its steps. */
const measureMemory = async (library: Library) => {
	const ready: number[] = [];
	const after: number[] = [];
	for (let index = 0; index < MEMORY_SAMPLES; index++) {
		const session = await open(
			browser,
			pageUrl(library, suite.memory.page),
			throttle,
		);
		try {
			ready.push(await session.heap());
			for (const step of suite.memory.steps) await perform(session.page, step);
			after.push(await session.heap());
		} finally {
			await session.close();
		}
	}
	const toMb = (bytes: number) => bytes / 1024 ** 2;
	return { readyMb: toMb(median(ready)), afterMb: toMb(median(after)) };
};

try {
	console.log(`Checking ${selected.map((library) => library.name).join(", ")}`);
	const problems = await check();
	if (problems.length) {
		console.error(
			`\nOutput doesn't match ${selected[0]?.name}'s:\n\n${problems.join("\n\n")}`,
		);
		process.exitCode = 1;
	} else {
		console.log("Every library renders the same DOM.\n");
	}

	if (!problems.length && !args.check) {
		const times = await measure();

		const scenarios = suite.scenarios.map((scenario) => {
			const measured = selected.map((library) => ({
				library: library.id,
				...summarise(times.get(`${scenario.id}/${library.id}`) ?? []),
			}));
			const fastest = Math.min(...measured.map((item) => item.medianMs));
			return {
				id: scenario.id,
				name: scenario.name,
				description: scenario.description,
				features: scenario.features,
				results: measured
					.map((item) => ({ ...item, relative: item.medianMs / fastest }))
					.sort((a, b) => a.medianMs - b.medianMs),
			};
		});

		const summary = selected
			.map((library) => ({
				library: library.id,
				geometricMean: geometricMean(
					scenarios.flatMap((scenario) =>
						scenario.results
							.filter((result) => result.library === library.id)
							.map((result) => result.relative),
					),
				),
			}))
			.sort((a, b) => a.geometricMean - b.geometricMean);

		console.log("Measuring memory…");
		const memory = [];
		for (const library of selected) {
			memory.push({ library: library.id, ...(await measureMemory(library)) });
		}

		console.log("Measuring size…");
		const sizes = [];
		for (const library of selected) {
			sizes.push({
				library: library.id,
				...(await measureSize(
					join(dist, "size", library.id),
					`${suite.id}/pages/${library.id}/${suite.size.page}.html`,
				)),
			});
		}

		const results = {
			suite: suite.id,
			name: suite.name,
			date: new Date().toISOString().slice(0, 10),
			commit: gitCommit(),
			environment: describeEnvironment(browser),
			settings: { samples, warmups: WARMUPS, throttle },
			libraries: await Promise.all(
				selected.map(async (library) => ({
					...library,
					version: library.package
						? await packageVersion(library.package)
						: null,
				})),
			),
			summary,
			scenarios,
			memory: {
				description: suite.memory.description,
				results: memory.sort((a, b) => a.afterMb - b.afterMb),
			},
			size: {
				description: suite.size.description,
				results: sizes.sort((a, b) => a.gzipBytes - b.gzipBytes),
			},
		};

		for (const scenario of results.scenarios) {
			console.log(`\n${scenario.name}`);
			console.table(
				scenario.results.map((result) => ({
					library: result.library,
					"median (ms)": result.medianMs.toFixed(2),
					"p95 (ms)": result.p95Ms.toFixed(2),
					relative: `${result.relative.toFixed(2)}×`,
				})),
			);
		}
		console.log("\nOverall (geometric mean of relative times)");
		console.table(
			summary.map((item) => ({
				library: item.library,
				relative: `${item.geometricMean.toFixed(2)}×`,
			})),
		);

		if (args.library) {
			console.log("\nNot writing results, because only some libraries ran.");
		} else {
			await mkdir(join(root, "results"), { recursive: true });
			await writeFile(
				join(root, "results", `${suite.id}.json`),
				`${JSON.stringify(results, null, "\t")}\n`,
			);
			console.log(`\nWrote results/${suite.id}.json`);
		}
	}
} finally {
	await browser.close();
	await server.close();
}
