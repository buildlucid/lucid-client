# Speculate

> Part of the Lucid Client suite

A library for optimising page loads and data fetching through prefetching and prerendering. Provides two main features:
1. Link prefetching/preloading using the Speculation Rules API (with fallbacks for browsers that dont support it yet).
2. Data prefetching for dynamic content (like pagination, tabs or dynamic lists).

## Features
- **Speculation Rules for Links**
    - Prefetch or prerender documents using the Speculation Rule API.
    - Fallback to `<link rel="prefetch">` or `fetch` for broader browser support.
    - Support for `visible`, `immediate`, `eager`, `moderate` and `conservative` triggers.
- **Data Prefetching**
    - Prefetch data when user intent is detected.
    - Configurable caching with limits and staleness.
    - Optimistic prefetching strategies.
    - Full TypeScript support.

## Installation

To install the Lucid Speculate library, run the following command:

```bash
npm install @lucidclient/speculate
```

### Link Speculation

#### Basic Usage

```typescript
import { speculateLinks } from "@lucidclient/speculate";

speculateLinks();

// Cleanup when needed
const destroy = speculateLinks();
destroy();
```

#### Configuring Links

```html
<a href="/page-1" data-speculate="visible">Prefetch in viewport</a>
<a href="/page-2" data-speculate--prefetch="moderate">Prefetch on interaction</a>
<a href="/page-3" data-speculate--prerender="visible">Prerender in viewport</a>
```

The specifier is the action and the value is the trigger. `data-speculate` on its own prefetches, like `data-speculate--prefetch`, and an empty or unknown trigger uses `moderate`. A link with both actions is prerendered.

Aside from the `visible` trigger, the others are based on the [Speculation Rule Eagerness](https://developer.chrome.com/docs/web-platform/prerender-pages#eagerness) values and are used only when Speculation Rules are supported. 

When Speculation Rules are not supported, the only valid triggers are `visible` and `moderate`. The `moderate` trigger being a fallback for the remaining triggers. The `prerender` action is ONLY supported with Speculation Rules and will fallback to the `prefetch` action when not supported.

#### Browser Support

##### Chrome

Chrome supports Speculation Rules, allowing for both prefetching and prerendering as intended. Chrome will always use the Speculation Rules API.

##### Firefox

Firefox does not support the Speculations API, but does support `<link rel="prefetch">`, however this requires cache headers (such as Cache-Control, Expires, or ETag) to function properly.

##### Safari

Safari doesn't support either the Speculation Rules API or `<link rel="prefetch">`. Instead, it uses a low-priority fetch, which requires cache headers (such as Cache-Control, Expires, or ETag) to function properly.

### Data Prefetching

#### Basic Usage

```typescript
import { Speculator } from "@lucidclient/speculate";

// A basic pagination example
const paginator = new Speculator({
    elements: document.querySelectorAll(".pagination-link"),
    // these will fire ASAP
    optimistic: [
        {
            elements: document.querySelector(".next-page"),
            // condition: () => hasNextPage
        },
        {
            elements: document.querySelector(".prev-page"),
            // condition: () => hasPrevPage
        },
    ],
    getCacheKey: (element) => {
        return element.getAttribute("data-page");
    },
    fetch: async (element) => {
        const page = element.getAttribute("data-page");
        const response = await fetch(`/api/posts?page=${page}`);
        const posts = await response.json();

        return {
            data: posts,
            error: undefined,
        };
    },
    onClick: async (e, data) => {
        // set loading state

        // handle error case
        if (data.error) {
        }

        // add filter/sort state to URL query params
        // replace posts in DOM
        // rebuild pagination

        // optimistically prefetch the next/prev pages again
        paginator.prefetch(document.querySelector(".next-page"));
        paginator.prefetch(document.querySelector(".prev-page"));

        // reset loading state
        // etc...
    },
});
```

Note for additional DOM event handlers other than `onClick` you can register these yourself and fetch the prefetched data via the `prefetch` public method. You may want to do this to handle `enter` and `space` `keydown` events for instance.

#### Intent and Caching

- Hovering a target element for `hoverDelay` (200ms by default) prefetches its data. Leaving the element before the delay cancels it.
- Clicking a target element prefetches its data if it isn't cached, then calls `onClick` with the result.
- The element passed to `getCacheKey`, `fetch` and `onClick`'s result is always the target element, even when the pointer is over markup inside it, such as a `<span>` label.
- Calls made while a fetch is in flight share it. Successful results are cached until they are older than `staleTime`, while results with an `error`, including a `fetch` that throws, are not kept, so the next intent fetches again.

#### Configuration Options

To see the available config, checkout the `SpeculatorConfig` type [here](https://github.com/buildlucid/lucid-client/blob/master/packages/speculate/src/types.d.ts).

#### Public Methods

- refresh(): void
- destroy(): void
- prefetch(element: Element): Promise<IntentResult<T, D>>
- prefetchAll(elements: Element[] | NodeListOf<Element>): Promise<IntentResult<T, D>[]>
- clearCache(element?: Element): void