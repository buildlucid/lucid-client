/**
 * Runs a benchmark suite in Chromium and writes `results/{suite}.json`.
 *
 * node src/run.ts catalyst                   build the pages, check every library's output, benchmark them all and write the results
 * node src/run.ts catalyst --check           only check that every library renders the same DOM as the first
 * node src/run.ts catalyst --library alpine  check and benchmark the suite's library and Alpine, without writing the results
 * node src/run.ts catalyst --scenario swap-rows  only check and benchmark one scenario, without writing the results
 * node src/run.ts catalyst --samples 5       take fewer samples, for a quick look
 * node src/run.ts catalyst --throttle 4      slow the CPU down 4 times, as on a mid-range phone
 *
 * Every sample opens its page in a fresh browser context, except in scenarios
 * with `reset` steps, which use one warmed-up page per library throughout.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { keepCpuBusy, launch, open, type Session } from "./browser.ts";
import { build, root } from "./build.ts";
import {
	countReplacedElements,
	difference,
	rememberElements,
	snapshot,
} from "./compare.ts";
import {
	describeEnvironment,
	gitCommit,
	packageVersion,
} from "./environment.ts";
import { perform, time, work } from "./measure.ts";
import { pool } from "./pool.ts";
import { serve } from "./server.ts";
import { measureSize } from "./size.ts";
import { geometricMean, median, summarise } from "./stats.ts";
import type { Library, Scenario, Suite } from "./suite.ts";

const dist = join(root, "dist");

/** How many times each scenario's warm-up steps run before timing. */
const WARMUPS = 5;
/** Fresh pages measured per library for the heap size. */
const MEMORY_SAMPLES = 5;
/** Pages the untimed phases, the output check and the heap sizes, open at once. */
const PARALLEL = 6;

const { values: args, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		check: { type: "boolean", default: false },
		library: { type: "string", multiple: true },
		scenario: { type: "string", multiple: true },
		samples: { type: "string", default: "15" },
		throttle: { type: "string", default: "1" },
	},
});

const samples = Number(args.samples);
const throttle = Number(args.throttle);
const suiteId = positionals[0];
if (!suiteId) throw new Error("Name a suite to run, such as `catalyst`.");

const loaded: Suite = (await import(`./${suiteId}/index.ts`)).default;
const unknownScenarios = args.scenario?.filter(
	(id) => !loaded.scenarios.some((scenario) => scenario.id === id),
);
if (unknownScenarios?.length) {
	throw new Error(`Unknown scenario: ${unknownScenarios.join(", ")}`);
}
const suite: Suite = args.scenario
	? {
			...loaded,
			scenarios: loaded.scenarios.filter((scenario) =>
				args.scenario?.includes(scenario.id),
			),
		}
	: loaded;
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
const releaseCpu = keepCpuBusy();

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
		for (let round = 0; round < (scenario.warmups ?? WARMUPS); round++) {
			for (const step of scenario.warmup) await perform(session, step);
		}
		for (const step of scenario.setup) await perform(session, step);
	} catch (error) {
		await session.close();
		throw error;
	}
	return session;
};

/** Problems a scenario that isn't `strict` found, by `{scenario}/{library}`, for the results. */
const notes = new Map<string, string>();

type Checked = { problems: string[]; html?: string };

/** Runs a scenario once for a library, and checks what it renders and logs */
const checkOne = async (
	scenario: Scenario,
	library: Library,
): Promise<Checked> => {
	const label = `${scenario.id} / ${library.id}`;
	const problems: string[] = [];
	let html: string | undefined;
	try {
		const session = await prepare(library, scenario);
		try {
			if (scenario.keepsElements) {
				await rememberElements(session.page, suite.root);
			}
			await perform(session, scenario.timed);
			if (scenario.keepsElements) {
				const replaced = await countReplacedElements(session.page, suite.root);
				if (replaced > 0) {
					problems.push(
						`${label}: rendered ${replaced} elements again instead of keeping them.`,
					);
				}
			}
			for (const step of scenario.check ?? []) await perform(session, step);
			if (suite.verify) {
				const problem = await suite.verify(session.page, scenario);
				if (problem && scenario.strict === false) {
					notes.set(`${scenario.id}/${library.id}`, problem);
					console.log(`Note for ${label}: ${problem}`);
				} else if (problem) problems.push(`${label}: ${problem}`);
			} else {
				html = await snapshot(session.page, suite.root);
			}
			if (session.messages.length) {
				problems.push(`${label} logged:\n${session.messages.join("\n")}`);
			}
		} finally {
			await session.close();
		}
	} catch (error) {
		problems.push(`${label}: ${String(error)}`);
	}
	return { problems, html };
};

/**
 * Runs every scenario once per library, several at a time as nothing is
 * timed, and checks each library's output: with the suite's `verify`, or
 * against the DOM the first library renders
 */
const check = async () => {
	const runs = suite.scenarios.flatMap((scenario) =>
		selected.map((library) => ({ scenario, library })),
	);
	const results = await pool(
		runs.map(
			({ scenario, library }) =>
				() =>
					checkOne(scenario, library),
		),
		PARALLEL,
	);
	const problems: string[] = [];
	results.forEach(({ problems: found, html }, index) => {
		problems.push(...found);
		const run = runs[index];
		if (html === undefined || !run) return;
		const first =
			results[runs.findIndex((other) => other.scenario === run.scenario)];
		const diff = first?.html === undefined ? "" : difference(first.html, html);
		if (diff) problems.push(`${run.scenario.id} / ${run.library.id}:\n${diff}`);
	});
	return problems;
};

/**
 * Times every scenario for every library, `samples` times each. A scenario
 * with `reset` steps keeps each library's page open between rounds, putting
 * it back to its starting state after each sample.
 */
const measure = async () => {
	const times = new Map<string, number[]>();
	const kept = new Map<string, Session>();
	try {
		for (let round = 0; round < samples; round++) {
			console.log(`Round ${round + 1} of ${samples}`);
			// Libraries take turns in a different order each round, so a change in
			// the machine's speed during the run doesn't favour one of them.
			const shift = round % selected.length;
			const order = [...selected.slice(shift), ...selected.slice(0, shift)];
			for (const scenario of suite.scenarios) {
				for (const library of order) {
					const key = `${scenario.id}/${library.id}`;
					const session = kept.get(key) ?? (await prepare(library, scenario));
					if (scenario.reset) kept.set(key, session);
					try {
						const ms =
							scenario.metric === "work"
								? await work(session, scenario.timed, scenario.settleMs ?? 1000)
								: await time(session.page, scenario.timed);
						times.set(key, [...(times.get(key) ?? []), ms]);
						for (const step of scenario.reset ?? [])
							await perform(session, step);
					} finally {
						if (!scenario.reset) await session.close();
					}
				}
			}
		}
	} finally {
		for (const session of kept.values()) await session.close();
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
			for (const step of suite.memory.steps) await perform(session, step);
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
			suite.verify
				? `\nThe output check failed:\n\n${problems.join("\n\n")}`
				: `\nOutput doesn't match ${selected[0]?.name}'s:\n\n${problems.join("\n\n")}`,
		);
		process.exitCode = 1;
	} else {
		console.log(
			suite.verify
				? "Every library passes the output check.\n"
				: "Every library renders the same DOM.\n",
		);
	}

	if (!problems.length && !args.check) {
		const times = await measure();

		const scenarios = suite.scenarios.map((scenario) => {
			const measured = selected.map((library) => {
				const note = notes.get(`${scenario.id}/${library.id}`);
				return {
					library: library.id,
					...summarise(times.get(`${scenario.id}/${library.id}`) ?? []),
					...(note ? { note } : {}),
				};
			});
			// A library that fails the check, such as one that ends on another slide,
			// did less than the scenario asks. It's listed after the others, which are
			// compared with the fastest library that passes.
			const passing = measured.filter((item) => !item.note);
			const fastest = Math.min(
				...(passing.length ? passing : measured).map((item) => item.medianMs),
			);
			return {
				id: scenario.id,
				name: scenario.name,
				description: scenario.description,
				features: scenario.features,
				metric: scenario.metric ?? "time",
				results: measured
					.map((item) => ({ ...item, relative: item.medianMs / fastest }))
					.sort(
						(a, b) =>
							Number(Boolean(a.note)) - Number(Boolean(b.note)) ||
							a.medianMs - b.medianMs,
					),
			};
		});

		// Each library's overall result covers the scenarios it passes.
		const summary = selected
			.map((library) => ({
				library: library.id,
				geometricMean: geometricMean(
					scenarios.flatMap((scenario) =>
						scenario.results
							.filter((result) => result.library === library.id && !result.note)
							.map((result) => result.relative),
					),
				),
			}))
			.sort((a, b) => a.geometricMean - b.geometricMean);

		// Neither is timed, so the libraries are measured side by side.
		console.log("Measuring memory and size…");
		const [memory, sizes] = await Promise.all([
			pool(
				selected.map((library) => async () => ({
					library: library.id,
					...(await measureMemory(library)),
				})),
				PARALLEL,
			),
			Promise.all(
				selected.map(async (library) => ({
					library: library.id,
					...(await measureSize(
						join(dist, "size", library.id),
						`${suite.id}/pages/${library.id}/${suite.size.page}.html`,
					)),
				})),
			),
		]);

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

		if (args.library || args.scenario) {
			console.log("\nNot writing results, because only part of the suite ran.");
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
	await releaseCpu();
	await browser.close();
	await server.close();
}
