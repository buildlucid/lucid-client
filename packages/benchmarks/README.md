# Lucid Client benchmarks

Compares how fast Lucid Client libraries run in a real browser with other libraries that do the same job. Each suite writes its results to `results/{suite}.json`, which the playground shows on its benchmark pages.

The Catalyst suite compares Catalyst with Alpine.js, petite-vue and hand-written DOM code ("Vanilla JS", the baseline).

The carousel suite compares Lucid Carousel with carousels that move their slides with transforms, Embla Carousel, Swiper and Splide, and with ones that scroll them with CSS scroll snapping as it does, Swiper's CSS mode, Blossom Carousel and Swiffy Slider.

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

For the carousel suite, run `npm run bench:carousel`, which builds Lucid Carousel and writes `results/carousel.json`. Every scenario waits for the carousels to settle, so a full run takes about 40 minutes.

While working on one library, run the runner directly from this package:

```bash
node src/run.ts catalyst --check                # only check every library renders the same DOM as Catalyst
node src/run.ts catalyst --library alpine       # benchmark Catalyst and Alpine, without writing results
node src/run.ts catalyst --scenario swap-rows    # check and benchmark one scenario, without writing results
node src/run.ts catalyst --samples 3            # take fewer samples, for a quick look
node src/run.ts catalyst --throttle 4           # slow the CPU down 4 times, as on a mid-range phone
```

The runner doesn't build Catalyst. Run `npm run bench` or build it first when you have changed it.

## How it works

- Every page is built for production with Vite, served with cross-origin isolation headers so timers are precise to 5 µs, and opened in Playwright's Chromium.
- Each sample opens its page in a fresh browser context. It runs the scenario's warm-up steps 5 times and its setup steps once, collects garbage, then times one step.
- A timed step starts with the click, call or typing that triggers it. It ends once the library has finished its work and the browser has recalculated styles and layout. Painting isn't timed, because every library renders the same DOM.
- Libraries take turns in a different order each round, so a change in the machine's speed during a run doesn't favour one of them. Results are the median of 15 samples.
- The runner keeps one CPU core busy while it runs. Otherwise the operating system slows the CPU down, or moves the page to an efficiency core, while the page is mostly idle, as it is while a carousel scrolls, and work spread over many frames measures several times slower than the same work done at once.
- Memory is the JavaScript heap after garbage collection, from the Chrome DevTools Protocol. Size is the JavaScript a page loads, built on its own and compressed with gzip and brotli, and the CSS its code imports.

Scenarios measure one of two things:

- `time`, the default, is the task the step runs in: from the step until the library's work and the browser's style and layout are done. The Catalyst suite measures this.
- `work` adds up the JavaScript, style and layout work the browser reports, from the step until the scenario's `settleMs` has passed, across every frame, scroll event and observer that follows. The carousel suite measures this, as carousels spread their work over an animation. Painting isn't counted, because how much of it runs on the main thread depends on the GPU, and headless Chromium has none. The step runs in a task of its own, as a click would, since the browser doesn't count script that the runner evaluates in the page.

## How it is organised

Code shared by every suite lives in `src/`, and code for one suite in `src/{suite}/`.

- `src/run.ts` runs a suite. `src/suite.ts` describes what a suite provides.
- `src/build.ts`, `src/server.ts` and `src/browser.ts` build, serve and open the pages.
- `src/measure.ts` performs and times steps in the page, and `src/compare.ts` checks the output.
- `src/stats.ts`, `src/size.ts` and `src/environment.ts` summarise the results.
- `src/catalyst/scenarios.ts` lists what the Catalyst suite measures, and `src/catalyst/data.ts` builds the rows and cards every page renders.
- `src/catalyst/pages/{library}/` holds each library's pages: `rows`, `start-up`, `search` and `markup`.
- `src/carousel/scenarios.ts` lists what the carousel suite measures, `src/carousel/verify.ts` checks each carousel shows the right slide, and `src/carousel/pages/{library}/` holds each library's `start-up`, `large` and `navigation` pages, built from its `carousel.ts`.

## Rules for pages

- Every library must render the same DOM as the suite's first library. The runner checks this before it times anything, comparing text, `class`, `hidden` and `aria-*` attributes. A suite whose libraries render different DOM for the same result, such as the carousel suite, checks the result with its own `verify` instead. A scenario marked `strict: false` still measures a library that fails the check, and the results note the problem. That library is listed after the ones that pass, which aren't compared with it, and the scenario is left out of its overall result.
- Keyed updates must keep the elements they update. For scenarios marked `keepsElements`, such as swapping and selecting rows, the check fails if the timed step renders elements again.
- Write pages the way the library's own documentation recommends, at their best: use its stores or components, keyed loops, bindings and events, and its fastest idiomatic form where it has more than one, such as a ternary class binding.
- Use the suite's data as it is, and do the same work in every library. For example, every search page filters with `filterRows`, and every rows page removes a row by its loop index.
- Pages expose anything a scenario calls, such as `start`, with `defineHarness` from `src/harness.ts`.
