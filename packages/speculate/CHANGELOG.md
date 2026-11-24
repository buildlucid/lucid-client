# @lucidclient/speculate

## v1.2.0 (unreleased)

## Breaking Changes

- Links are configured with `data-speculate` attributes instead of `rel`, following the suite's `data-{namespace}--{specifier}` grammar. `rel="prefetch:visible"` is now `data-speculate--prefetch="visible"`, or `data-speculate="visible"`, and `rel="prerender:moderate"` is now `data-speculate--prerender="moderate"`. `rel` is left to the tokens browsers, validators and SEO plugins expect, and `rel` values are no longer read.
- The library is a default export with `init`, `refresh` and `destroy`, like the rest of the suite. `speculateLinks()` is now `speculate.init()`, and `destroy` is a method rather than the function `speculateLinks` returned.
- Removed `Speculator`, so the library is only about links.
- The speculation rules and prefetch links the library adds are marked with `data-speculate--generated` instead of `gen-speculate`.
- Messages about the connection only log in the development build, which bundlers pick through the `development` export condition.

## Features

- Added `refresh()`, which picks up links added or changed after `init`, such as after a client side navigation, and stops watching `visible` links that left the page. Rules already added stay until `destroy()`.
- Added the `hoverDelay` option. Without Speculation Rules, a `moderate` link is prefetched once the pointer rests on it for 200ms, and moving off it first cancels, rather than on every pass of the pointer.
- Without Speculation Rules, pressing a link prefetches it, and intent is read from the whole page, so `moderate` links added after `init` work without a refresh.
- Links that are set up together share one Speculation Rules script, rather than each having its own, and a rule an earlier script has for the same action, eagerness and URL isn't added again.
- The development build warns about speculate attributes on an element that isn't a link, an unknown trigger, and links that can't be speculated: links to another origin or that aren't http or https, links that open in another tab or window, downloads and links without an `href`.

## Patch Changes

- Touching markup inside a link, such as a `<span>` label, prefetches it. It was ignored.
- Rules keep the link's hash, as the browser matches the full URL, and the same link is only added once. Fallback prefetches leave the hash out, so links to one page with different hashes share a prefetch. A link with a hash was speculated again every time before.
- Links to the current path with a different query, such as `?page=2`, are speculated. They were skipped as the current page.
- `destroy()` before the browser is idle stops the links from being set up afterwards.
- A fallback `fetch` that fails, or is cancelled by `destroy()`, no longer causes an unhandled promise rejection.
- Importing the library no longer reads the DOM, so it can be imported where there is no DOM, such as during server rendering.
- Links with a `target` other than `_self`, or one inherited from `<base target>`, links with `download`, and links that aren't http or https are no longer speculated. Only `_blank` was left out before.

## v1.1.2

## Patch Changes

- Improved browser support for speculate links.

## v1.1.1

## Patch Changes

- Updated the `refresh` method to include a partial config prop for `Speculator`.

## v1.1.0

## Minor Changes

- Added a new `refresh` method to `Speculator`.

## v1.0.1

## Patch Changes

- `onClick` callback now returns `Event`.
- `TargetElements` now supports being null | undefined so you dont have to check prior to passing them to Speculator.

## v1.0.0

### Major Changes

- Reworked the `PrefetchData` class into `Speculator`.
- `Speculator` includes better cache management, support for multiple elements, error handling and optimistic prefetching.

## v0.3.0

### Minor Changes

- Added the ability to destroy the instance. This will destroy any event listeners, abort fetch requests and tidy up any generated script/link elements.
- Fixed a bug where `checkConnection` wasnt being used.

## v0.2.1

### Patch Changes

- Fixed a bug where rel attributes with multiple values would not be parsed correctly.
- Added validation for the rel speculation actions and triggers.

## v0.2.0

### Minor Changes

- Added fallback support for Safari via `fetch`.
- Script is deferred using `requestIdleCallback` if available to not block the main thread.

## v0.1.0

### Minor Changes

- The initial release of the Speculate library.