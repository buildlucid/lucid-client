# Playground

A test bench for the Lucid Client packages, built with Astro and Tailwind.
Each page is a set of scenarios: every scenario says what it covers, lists what
correct behaviour looks like, and shows the markup it uses. Actions, effects,
consent changes and library warnings appear in the activity log.

## Running it

From the repository root:

```bash
npm run dev
```

This rebuilds the packages in watch mode and serves the playground at
`http://localhost:4321`. The playground imports each package's `dist` output,
so a package change shows up once its rebuild finishes.

## Structure

```text
src/
├── nav.ts                  Sidebar groups and pages, also used by the overview
├── layouts/Playground.astro
├── components/
│   ├── Scenario.astro      A scenario card: description, gap, demo, expectations, markup
│   ├── AttributeReadout.astro  Live view of an element's attributes
│   ├── LogPanel.astro      The activity log
│   └── Sidebar.astro, NavLinks.astro, Brand.astro
├── lib/
│   ├── log.ts              createLogger(), and mirroring of library console output
│   ├── catalyst.ts         initCatalyst(), which initialises Catalyst with a page's stores in debug mode
│   ├── markup.ts           Formats a scenario's markup for its Markup panel
│   └── text.ts             `backticks` to <code> for scenario copy
├── pages/                  One page per package or Catalyst feature
└── scripts/                The script for each page
```

## Adding a scenario

1. Add a `<Scenario>` to the page. `expect` describes correct behaviour, even
   when a package doesn't do it yet.
2. If the scenario exposes a package bug or missing feature, describe it with
   the `gap` prop. It shows as an amber callout until the package is fixed.
3. Put the stores or setup in the page's script under `src/scripts/`. Catalyst
   pages register only their own stores with `initCatalyst({ stores })`.
4. Log anything worth seeing with `createLogger("name")`.

The Markup panel leaves out `class` attributes and any `pg-*` element, so wrap
playground-only helpers, such as readouts and test controls, in a `pg-*`
element.

A new page also needs an entry in `src/nav.ts`.
