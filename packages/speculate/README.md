# Speculate

> Part of the Lucid Client suite

Prefetch and prerender the pages your links go to, so they load quicker or show straight away. Links are set up with `data-speculate` attributes, and use the [Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API) where the browser supports it, falling back to prefetching on intent where it doesn't.

## Features

- Attribute Driven: Choose what happens to each link, and when, with `data-speculate--*` attributes.
- Speculation Rules: Prefetch or prerender with the browser's own `immediate`, `eager`, `moderate` and `conservative` eagerness.
- Visible Trigger: Speculate a link once it scrolls into view.
- Fallbacks: Prefetch with `<link rel="prefetch">` or a low priority `fetch` in browsers without Speculation Rules, when the pointer rests on a link, or it is pressed or focused.
- Kind to Connections: Does nothing for visitors who are offline, saving data or on a 2G or 3G connection.
- Safe Links Only: Links to other origins, new tabs and downloads are left out, and the same rule or prefetch is never added twice.
- Dynamic Markup: Call `refresh()` to pick up links added or changed after `init`.
- Development Warnings: Markup mistakes are pointed out while you develop, and left out of production builds.

## Getting Started

### Installation

```bash
npm install @lucidclient/speculate
```

### Usage

```typescript
import speculate from "@lucidclient/speculate";

speculate.init();
```

```html
<a href="/pricing" data-speculate>Prefetched when the visitor shows intent</a>
<a href="/blog" data-speculate="visible">Prefetched once it scrolls into view</a>
<a href="/signup" data-speculate--prerender="moderate">Prerendered when the visitor shows intent</a>
```

The library needs no CSS. On a site with a Content Security Policy, see [Content Security Policy](#content-security-policy).

## Markup

### Attributes

The specifier is the action, and the value is the trigger.

| Attribute | Description |
| --- | --- |
| `data-speculate` | Prefetches the link. |
| `data-speculate--prefetch` | Prefetches the link. The same as `data-speculate`. |
| `data-speculate--prerender` | Prerenders the link, and adds a prefetch as another candidate the browser can use. Wins when a link also has a prefetch attribute. |

### Triggers

| Trigger | Description |
| --- | --- |
| `visible` | Once the link scrolls into view. |
| `immediate` | Straight away. |
| `eager` | Sooner than `moderate`, such as on a short hover. |
| `moderate` | The default. When the visitor shows intent, such as resting the pointer on the link or pressing it. |
| `conservative` | When the link is pressed. |

An empty or unknown trigger uses `moderate`. Apart from `visible`, these are the Speculation Rules [eagerness](https://developer.chrome.com/docs/web-platform/prerender-pages#eagerness) levels, and the browser decides exactly when each one fires.

## How It Works

### With Speculation Rules

Links are added to a `<script type="speculationrules">` in `<head>` once the browser is idle, and the browser waits for their trigger. Links that come into view together, or are picked up by the same `refresh()`, share one script.

A rule is only added once for each action, eagerness and URL, so a link already in a rule set isn't added again. The same URL can still have rules with different eagerness, such as one link to it with `eager` and another with `moderate`. URLs keep their hash, as the browser matches the full URL when the visitor hovers a link or follows it.

Rules are for URLs rather than links, so the browser can act on any link to a URL with a rule. With a `data-speculate--prerender="eager"` link to `/pricing` in the header, hovering a footer link to `/pricing` without the attribute can prerender it too.

### Content Security Policy

The rule sets are inline scripts. With a Content Security Policy that limits `script-src`, add `'inline-speculation-rules'` so they can run:

```text
Content-Security-Policy: script-src 'self' 'inline-speculation-rules'
```

Without it, the browser blocks the rule sets and nothing is speculated. The browser still reports Speculation Rules as supported, so the library can't fall back to prefetching.

### Without Speculation Rules

Prerendering needs Speculation Rules, so prerender links are prefetched instead. `visible` links are prefetched once they scroll into view, and every other trigger works like `moderate`:

- Resting the pointer on a link for `hoverDelay`, 200ms by default, prefetches it. Moving off it first cancels.
- Pressing or focusing a link prefetches it straight away.

The page is prefetched with `<link rel="prefetch">`, or a low priority `fetch` where that isn't supported. Each page is only prefetched once, ignoring the hash. Both only help when the page is sent with cache headers, such as `Cache-Control`, as the browser reads it from its HTTP cache when the visitor follows the link.

### Links that aren't speculated

- Links that aren't http or https, such as `mailto:`, and links to another origin.
- Links with a `target` other than `_self`, or that inherit one from `<base target>`, as they open in another tab or window.
- Links with `download`.
- Links to the current page, ignoring the hash. Links to the same path with a different query, such as `?page=2`, are kept.

The development build warns about each of these, apart from links to the current page.

### Connections

On `init`, the library does nothing when the visitor is offline, has Save-Data turned on, or is on a 2G or 3G connection. The development build says why.

### What to speculate

Prefetching and prerendering run the page's server code, and prerendering runs its scripts too. Only speculate pages that are safe to load without being visited, so not a sign out link or one that adds to a basket. See Chrome's guide to [prerendering pages](https://developer.chrome.com/docs/web-platform/prerender-pages) for how analytics and other scripts behave in a prerendered page.

## API

```typescript
import speculate from "@lucidclient/speculate";

speculate.init({ hoverDelay: 100 });

// After adding links, such as after a client side navigation
speculate.refresh();

speculate.destroy();
```

| Method | Description |
| --- | --- |
| `init(options?)` | Sets up every link once the browser is idle. Calling it again starts over. |
| `refresh()` | Picks up links added or changed since `init`, and stops watching `visible` links that left the page. Rules already added stay until `destroy()`. |
| `destroy()` | Stops speculating, removes the rule sets and prefetch links the library added and cancels prefetches in flight. |

| Option | Default | Description |
| --- | --- | --- |
| `hoverDelay` | `200` | How long the pointer rests on a `moderate` link before it is prefetched, in milliseconds. Only used without Speculation Rules, as browsers with them wait for their own hover. |

Without Speculation Rules, intent is read from the whole page, so a `moderate` link added after `init` works without `refresh()`. With them, and for `visible` links, call `refresh()`.

### Development Build

The library warns about markup it can't work with, such as attributes on an element that isn't a link, an unknown trigger, or a link it can't speculate. Warnings only log in the development build, which bundlers such as Vite and webpack pick through the `development` export condition while you develop. Production builds leave them out.

## Browser Support

- Chrome and Edge support Speculation Rules, so links are prefetched or prerendered as their trigger says.
- Firefox supports `<link rel="prefetch">`, which needs cache headers to help.
- Safari supports neither, so links are prefetched with a low priority `fetch`, which needs cache headers to help.

Support for Speculation Rules is growing, and the library uses it in any browser that reports it through `HTMLScriptElement.supports("speculationrules")`.
