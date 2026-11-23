# Lucid Client benchmarks

Compares how fast Lucid Client libraries run in a real browser with other libraries that do the same job. Each suite writes its results to `results/{suite}.json`, which the playground shows on its benchmark pages.

The Catalyst suite compares Catalyst with Alpine.js, petite-vue and hand-written DOM code ("Vanilla JS", the baseline).

## Running

Install Chromium for Playwright once:

```bash
npx playwright install --no-shell chromium
```

Then, from the repository root:

```bash
npm run bench
```

This builds Catalyst and the benchmark pages, checks every library's output, benchmarks them all and writes `results/catalyst.json`. A full run takes about five minutes. Commit the new results with the change that caused them.

While working on one library, run the runner directly from this package:

```bash
node src/run.ts catalyst --check                # only check every library renders the same DOM as Catalyst
node src/run.ts catalyst --library alpine       # benchmark Catalyst and Alpine, without writing results
node src/run.ts catalyst --samples 3            # take fewer samples, for a quick look
node src/run.ts catalyst --throttle 4           # slow the CPU down 4 times, as on a mid-range phone
```

The runner doesn't build Catalyst. Run `npm run bench` or build it first when you have changed it.

## How it works

- Every page is built for production with Vite, served with cross-origin isolation headers so timers are precise to 5 µs, and opened in Playwright's Chromium.
- Each sample opens its page in a fresh browser context. It runs the scenario's warm-up steps 5 times and its setup steps once, collects garbage, then times one step.
- A timed step starts with the click, call or typing that triggers it. It ends once the library has finished its work and the browser has recalculated styles and layout. Painting isn't timed, because every library renders the same DOM.
- Libraries take turns in a different order each round, so a change in the machine's speed during a run doesn't favour one of them. Results are the median of 15 samples.
- Memory is the JavaScript heap after garbage collection, from the Chrome DevTools Protocol. Size is the JavaScript a page loads, built on its own and compressed with gzip and brotli.

## How it is organised

Code shared by every suite lives in `src/`, and code for one suite in `src/{suite}/`.

- `src/run.ts` runs a suite. `src/suite.ts` describes what a suite provides.
- `src/build.ts`, `src/server.ts` and `src/browser.ts` build, serve and open the pages.
- `src/measure.ts` performs and times steps in the page, and `src/compare.ts` checks the output.
- `src/stats.ts`, `src/size.ts` and `src/environment.ts` summarise the results.
- `src/catalyst/scenarios.ts` lists what the Catalyst suite measures, and `src/catalyst/data.ts` builds the rows and cards every page renders.
- `src/catalyst/pages/{library}/` holds each library's pages: `rows`, `start-up`, `search` and `markup`.

## Rules for pages

- Every library must render the same DOM as the suite's first library. The runner checks this before it times anything, comparing text, `class`, `hidden` and `aria-*` attributes.
- Write pages the way the library's own documentation recommends. Use its stores or components, bindings, loops and events.
- Use the suite's data as it is, and do the same work in every library. For example, every search page filters with `matchesQuery`.
- Pages expose anything a scenario calls, such as `start`, with `defineHarness` from `src/harness.ts`.
