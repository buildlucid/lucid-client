# Speculate

> Part of the Lucid Client suite - documentation coming soon

Make pages load faster by prefetching or prerendering the pages your links go to. Set it up with HTML attributes, and it uses the browser's Speculation Rules API where it's supported.

## Features

- Attribute Driven: Choose what happens to each link with `data-speculate--*` attributes.
- Prefetch or Prerender: Fetch a page ahead of time, or render it ready to show straight away.
- Choose When: When the visitor shows intent, when a link scrolls into view, or straight away.
- Works Everywhere: Falls back to prefetching in browsers without Speculation Rules.
- Kind to Connections: Does nothing for visitors saving data or on slow connections.

## Installation

```bash
npm install @lucidclient/speculate
```

## Usage

```typescript
import speculate from "@lucidclient/speculate";

speculate.init();
```

```html
<a href="/pricing" data-speculate>Prefetched when the visitor shows intent</a>
<a href="/blog" data-speculate="visible">Prefetched once it scrolls into view</a>
<a href="/signup" data-speculate--prerender="moderate">Prerendered when the visitor shows intent</a>
```

On a site with a Content Security Policy, add `'inline-speculation-rules'` to `script-src`.
