# @lucidclient/catalyst

## v0.6.0 (unreleased)

### Features:

- Added nearest-store inference for `$state`, `@action` and `#identifier` references, while keeping explicit `scope:$state`, `scope:@action` and `scope:#identifier` references for crossing store boundaries.
- Rebuilt dynamic synchronization so reactions are idempotent and are disposed with their elements.
- Loops now keep the markup of items that are still in the array, matching them by identity, and `$index` updates as items move. Reordering moves only the items that change place, and whitespace around the template's element that includes a line break isn't rendered.
- Traps can now be stacked, and elements marked `data-trap-allow` stay interactive while a trap is active.
- Added `defineStore`. State, `computed` values, actions, effects and `init` are top-level keys, and their types are inferred without explicit generics. State and computed values are read with `$name`, and actions are called with `@name`.
- Store state is reactive, built on Solid 2's signals rather than its stores, which keeps Catalyst much smaller. Actions read `state.key` and write with `setState((state) => { ... })`, and changing nested data, such as pushing to an array, updates the bindings, loops and `data-state--*` attributes that read it.
- Added `computed` values: read-only, memoised values derived from state, read in markup like state and available on `state` in store code.
- Added the `effect(compute, callback)` helper for store effects, which types the callback's value from `compute`.
- Stores are registered with `Catalyst.start({ stores: { scope: definition } })`. One definition can be registered under several scopes, and `Catalyst.add({ stores })` registers stores after `start`, rebuilding any that are already on the page.
- `init` is a store hook rather than an action. It can write state, and the function it returns, including from an async `init`, runs when the store is destroyed.
- Refs are part of the core. `refs.get<E>(name)` returns one element and `refs.all<E>(name)` returns every element registered under a name.
- `flush` and `untrack` are exported from `solid-js`, and `snapshot` returns the plain value behind a piece of state.
- `start`, `sync` and `refresh` apply bindings before they return, and `start` waits for `DOMContentLoaded` when it runs before `<body>` exists.
- Added the `model` reaction for two-way binding of form fields. Text, number, checkbox, radio and select fields are supported, checkboxes can be bound to an array, values keep the type of their state, state follows a native form reset, and `$item.field` inside a loop writes to the store the loop renders.
- Added the `css` reaction. `data-css--{name}` sets the `--{name}` custom property from state, a computed value, an action or a loop value. Booleans are written as `true` and `false`, `null`, `undefined` and empty strings remove the property, and the element's earlier inline value comes back when the directive is disposed.
- Added `data-dom--checked`, which sets a checkbox or radio's `checked` property rather than its default.
- `data-dom--value` selects every matching option of a `<select multiple>` from an array, and applies a select's value again when its options change, such as when a loop renders them.
- Actions called from inside a loop item receive a `LoopItem` with its `item`, `index`, `indexOne` and `parent`: after the `Event` for events, and as the only argument for actions that provide a value.
- Added persisted state, imported from `@lucidclient/catalyst/persistence` so pages that don't use it don't include it. Pass `persistence()` to `Catalyst.start`, then wrap a state value in `persisted()`, or list state keys in a `data-persist` attribute, to save it to `localStorage`, `sessionStorage` or a registered storage adapter and restore it when the page loads again. Stored values are restored before the store is created, are ignored when their type no longer matches, and can follow changes from other tabs with `sync`. `clearPersisted(scope)` removes a store's saved values.
- Added event modifiers: `prevent`, `stop`, `once`, `self`, `passive`, `capture`, `debounce` and `throttle` with an optional duration, `shift`, `ctrl`, `alt` and `meta`, key names such as `keydown.escape`, and `transition`, which runs the action in a view transition whose type is the store's scope.
- Added the `outside` event target. `data-events--outside.click` calls an action for clicks outside the element while it is shown.
- Added `viewTransition(update, { types })`, which runs a state change in a view transition and applies it to the page before the browser captures it. Without browser support, or when the user prefers reduced motion, the change is applied straight away.
- Added the `classes` reaction. `data-class--{name}` toggles one class, and `data-class` applies classes from a string, an array or an object, leaving the element's other classes alone.
- `data-model` opens and closes a `<dialog>` as a modal, a `popover` element and a `<details>` from boolean state, and writes `false` when the browser closes them.
- Added the `lazy`, `trim` and `debounce` modifiers to `data-model`, such as `data-model--debounce.300ms`.
- Added the `conditional` reaction. `data-if` renders its template while a value is truthy, and removes it with its listeners, effects and stores while it is falsy.
- Added the `intersect` reaction. `data-intersect` calls an action when the element scrolls into view, and `data-intersect--leave` when it scrolls out of view, with the `once`, `half` and `full` modifiers and a margin such as `200px`.
- Added the `uid` reaction. `data-uid="name"` gives an element a generated id, unique to its loop item or store, and `data-uid--for="name"` writes the same id to another attribute.
- Added `data-ignore`, which keeps Catalyst out of an element and everything inside it. Its name is set by the `ignore` attribute option.
- Catalyst ships a development build, which bundlers pick through the `development` export condition, and a smaller production build without warnings or `debug` messages.
- Catalyst is faster throughout: syncing walks each subtree once, loops set up new items in one pass and remove items without disposing them twice, events and refs need no reactive root, and bindings skip DOM writes that wouldn't change anything.
- Reactions can't use the `carousel`, `cookie` or `speculate` attributes, which Carousel, Cookie Controller and Speculate own.
- In the development build, Catalyst now warns when a different store is registered for a scope that already has one, when state is written directly instead of through `setState`, when `sync` runs before `start`, when a `data-dom` specifier is unknown, and when a lowercased state attribute cannot match camelCase state. In debug mode it also warns when markup uses a first-party reaction that isn't registered.

### Breaking Changes:

- Renamed the package from `@lucidclient/elements` to `@lucidclient/catalyst`.
- Removed the all-in preset, so only the reactions you register are included.
- Reworked all non-store behavior into first-party reactions that share one directive format.
- Simplified reaction attributes to `data-{reaction}--{specifier}`, such as `data-events--click` and `data-dom--text`.
- Replaced the textual loop index placeholders with `$item`, `$index`, `$indexOne` and traversable `$parent` loop contexts.
- Replaced `storeModule` with `defineStore` and `Catalyst.start({ stores })`. State is a plain object of values instead of a record of signals, actions and effects are top-level keys instead of being returned from `setup`, and the `cleanup` key is replaced by the function `init` returns.
- Store effects always run for as long as their store exists. The `effects` reaction, `data-effects`, and the separate `manual` and `global` effects are removed, and `defineEffect` is replaced by the `effect` helper.
- Upgraded to Solid 2. State writes apply on the next microtask (call `flush()` to apply them sooner), and state can't be written while a computed value or an effect's tracked function runs.
- `createSignal`, `createMemo` and `createEffect` are no longer re-exported, and `registerReaction` is replaced by `Catalyst.start({ reactions })`. The `refs` reaction is no longer exported, because refs are always available.
- A `data-state--*` attribute now sets its state's starting value even when the store definition declares a default, which is kept for its type.
- Custom reactions receive a public store with `key`, `element`, `state`, `setState`, `actions` and `refs` from `context.getStore`, and directives no longer have a `synthetic` field.
- `data-state--*` attributes now map to camelCase keys, so `data-state--user-name` is `$userName`.
- `data-bind` now removes the attribute for `false`, `null` and `undefined`, and writes an empty value for `true`. `aria-*`, `data-*` and enumerated attributes such as `draggable` still receive `"true"` and `"false"`.
- `data-trap` now makes everything outside the trap inert at every level of the page, not just other children of `<body>`, and moves focus into the trap.

### Bug Fixes:

- An error thrown from a store effect's callback or cleanup is logged with the effect and store names, and callbacks run untracked, so reading state in them no longer logs Solid's `STRICT_READ_UNTRACKED` warning.
- A different reaction reusing a registered name now warns, instead of being dropped silently.
- Directives inside a store element skipped as a duplicate scope are left unbound, instead of being initialised without a scope, clearing their markup and warning.
- Directives that reference a store that doesn't exist yet are left untouched until a sync creates it, and wait for a new store when it is removed.
- Replacing a store's markup and syncing it in the same task no longer skips the new store as a duplicate.
- A `data-state--*` attribute added later for declared state syncs both ways straight away, instead of one way until the next sync.
- Focus moves into a trap after the rest of the update, so a binding that shows the trap applies first wherever it is in the markup.
- Fixed state bindings inside loop templates, including `data-bind--href="$item.url"` when the array comes from a store definition's state.
- Primitive, object and array state attributes stay synchronized without state mutations driving bindings.
- State attributes are no longer rewritten on start: `""`, `"007"`, long numeric ids and other values that would not convert back exactly stay strings.
- State keeps its type when its attribute changes, and removing a state attribute no longer adds it back as `"null"`.
- `data-dom--text` renders `null` and `undefined` as empty text, and now works on SVG elements.
- `data-bind` writes case-sensitive SVG attributes such as `viewBox` with their correct casing.
- Closing a trap only restores the `inert` attributes and page overflow it changed, and closing a stacked trap no longer releases the trap beneath it.
- A store whose `state`, `computed`, `actions`, `effects`, `init` or cleanup throws no longer stops `start`, `sync` or `destroy` for the rest of the page.
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
