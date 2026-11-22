# @lucidclient/catalyst

## v0.6.0 (unreleased)

### Features:

- Added nearest-store inference for `$state`, `@action` and `#identifier` references, while keeping explicit `scope:$state`, `scope:@action` and `scope:#identifier` references for crossing store boundaries.
- Rebuilt dynamic synchronization so reactions are idempotent and are disposed with their elements.
- Loops now keep the markup of items that are still in the array, matching them by identity, and `$index` updates as items move.
- Traps can now be stacked, and elements marked `data-trap-allow` stay interactive while a trap is active.
- Added `defineEffect` to type a store effect's value, and `flush` and `untrack` are now exported.
- `start`, `sync` and `refresh` apply bindings before they return, and `start` waits for `DOMContentLoaded` when it runs before `<body>` exists.
- Catalyst now warns when a store module is registered after its store exists, when `sync` runs before `start`, when a `data-dom` specifier is unknown, and when a lowercased state attribute cannot match camelCase module state.

### Breaking Changes:

- Renamed the package from `@lucidclient/elements` to `@lucidclient/catalyst`.
- Removed the all-in preset, so only the reactions you register are included.
- Reworked all non-store behavior into first-party reactions that share one directive format.
- Simplified reaction attributes to `data-{reaction}--{specifier}`, such as `data-events--click`, `data-dom--text` and `data-effects`.
- Replaced the textual loop index placeholders with `$item`, `$index`, `$indexOne` and traversable `$parent` loop contexts.
- Reworked store modules around per-store `state` factories and `setup` callbacks, so state and action types are inferred without explicit generics.
- Upgraded to Solid 2. The re-exported `createEffect` now takes separate `compute` and `effect` functions, signal writes apply on the next microtask (call `flush()` to apply them sooner), and signals can't be written in the body of `setup` or a `state` factory.
- Store effects are now `{ compute, effect }` objects. `compute` tracks the state it reads, and `effect` receives its value with `{ isInitial, previous }` and can return a cleanup function.
- `data-state--*` attributes now map to camelCase keys, so `data-state--user-name` is `$userName`.
- `data-bind` now removes the attribute for `false`, `null` and `undefined`, and writes an empty value for `true`. `aria-*`, `data-*` and enumerated attributes such as `draggable` still receive `"true"` and `"false"`.
- `data-trap` now makes everything outside the trap inert at every level of the page, not just other children of `<body>`, and moves focus into the trap.

### Bug Fixes:

- Fixed state bindings inside loop templates, including `data-bind--href="$item.url"` when the array comes from a store module signal.
- Primitive, object and array state attributes stay synchronized without state mutations driving bindings.
- State attributes are no longer rewritten on start: `""`, `"007"`, long numeric ids and other values that would not convert back exactly stay strings.
- State keeps its type when its attribute changes, and removing a state attribute no longer adds it back as `"null"`.
- `data-dom--text` renders `null` and `undefined` as empty text, and now works on SVG elements.
- `data-bind` writes case-sensitive SVG attributes such as `viewBox` with their correct casing.
- Closing a trap only restores the `inert` attributes and page overflow it changed, and closing a stacked trap no longer releases the trap beneath it.
- A store module whose `state` factory, `setup` or `cleanup` throws no longer stops `start`, `sync` or `destroy` for the rest of the page.
- `refresh(scope)` re-binds directives elsewhere on the page that reference the refreshed store, and directives that reference a store before it exists start working once it is created.
- Loops clear their items when the array becomes `null` or `undefined`, and replace server-rendered placeholders without leaking their directives.
- A store inside a loop is no longer recreated when its `init` action reads its own state.
- Removing markup no longer gets slower as the page gains more directives.
- Directives inside a store that reuses another element's scope are left unbound instead of reading the other store's state.
- Changing an element's `data-store` value now replaces its store.

## v0.5.1

### Patch Changes

- Fixed bug where in watch state setup, if the state was of type array/object we returned instead of continuing. This is responsible for keeping `data-state` attributes and subsequently `data-bind` in sync.

## v0.5.0

## Minor Changes

- Added support for the `data-loop` directive.
- Fixed bug where data-bind directives wouldnt work for any state registered through the store modules as opposed to data-state.
- DOM handler focus is now wrapped in a setTimeout so its delayed slightly. This means if its used within a trap target it still works.

## v0.4.0

### Minor Changes

- Added the concept of global and manual effects. Global effects are always initialised, while manual one need to be called via a `data-effect="scope:manulEffect"` attribute.

## v0.3.1

### Patch Changes

- Fixed indentation in README.

## v0.3.0

### Minor Changes

- Added support for handler specifiers to include multiple specifiers seperated by dot notation.
- All helpers are now exported. This means everything you may need to create third-party handlers can now be accessed.
- Event handler now supports registering event handlers on `document`, `body`, `window` and `head` by prefixing the event name with the target. Ie. `data-handler--event.document.click="myAction"`.
- Breaking change: all state values in `data-bind--` attributes must be prefixed with `$`. Ie. `data-bind--aria-label="scope:$state"`.
- All first-party handlers now support using state as well as actions. Just prefix the value with either a `$` or `@` to denote the member type.
- Added a new first party handler for trapping focus. This can be used via the `data-handler--trap` attribute and supports both member types.
- Added a new optional cleanup callback for store modules.
- Added a new `data-effect` attribute for registering effects through attributes.
- Added support for handlers to be registered through `Catalyst.start`.
