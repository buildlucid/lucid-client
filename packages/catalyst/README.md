# Catalyst

> Part of the Lucid Client suite

A lightweight reactive UI library that connects HTML attributes to typed
JavaScript store modules. Catalyst uses SolidJS signals for reactivity while
keeping application logic out of markup.

## Installation

```bash
npm install @lucidclient/catalyst
```

## Getting started

```ts
import Catalyst, { createSignal, storeModule } from "@lucidclient/catalyst";
import { dom, events } from "@lucidclient/catalyst/reactions";

storeModule("counter", {
    state: () => ({
        count: createSignal(0),
    }),
    setup: (store) => ({
        actions: {
            increment: () => {
                const [, setCount] = store.state.count;
                setCount((count) => count + 1);
            },
        },
    }),
});

Catalyst.start({ reactions: [events, dom] });
```

```html
<div data-store="counter">
    <button data-events--click="@increment">
        Count: <span data-dom--text="$count"></span>
    </button>
</div>
```

Reactions are registered explicitly, so an application only includes the
behavior it uses. Catalyst exports `refs`, `bind`, `effects`, `loop`, `events`,
`dom`, and `trap` from `@lucidclient/catalyst/reactions`.

`start` waits for `DOMContentLoaded` when it runs before `<body>` exists, and
returns with every binding applied.

## Reactivity

Catalyst is built on Solid 2 and re-exports `createSignal`, `createMemo`,
`createEffect`, `flush` and `untrack` from `solid-js`. Two Solid 2 rules apply to
store modules:

- Signal writes are batched until the next microtask. Reading a signal straight
  after writing it returns the previous value; call `flush()` first if an action
  needs the new value immediately.
- Signals cannot be written while a reactive scope is being set up. Write state
  from actions, event handlers, effect callbacks or the `init` action, not from
  the body of `setup` or the `state` factory.

## Stores and state

`data-store` creates a scoped store. State declared with `data-state--*` is
parsed into its inferred JavaScript type and kept synchronized with its SolidJS
signal in both directions.

```html
<div
    data-store="profile"
    data-state--name="Ada"
    data-state--active="true"
    data-state--visits="3"
    data-state--user-name="ada"
    data-state--links='[{"title":"Home","url":"/"}]'
></div>
```

Attribute names are kebab-case and map to camelCase state keys, as `dataset`
does: `data-state--user-name` is the `userName` state, referenced as
`$userName`. HTML lowercases attribute names, so `data-state--userName` cannot
match `userName`; Catalyst warns when it finds that mismatch.

Values are inferred without loss. `true`, `false`, `null`, numbers that convert
back to the same text, and JSON objects or arrays become typed values; anything
else stays a string, so `""`, `"007"` and long numeric ids are kept as written.
Once a state value has a type it keeps it: when the attribute changes, a string
state stays a string even if the new value looks numeric. Removing a state
attribute sets its state to `null` without recreating the attribute.

Store modules add typed state and application logic. State and actions are
inferred from their definitions, so they do not need explicit generic types:

```ts
import {
    createSignal,
    defineStoreModule,
    storeModule,
} from "@lucidclient/catalyst";

const profileModule = defineStoreModule({
    state: () => ({
        name: createSignal("Ada"),
        active: createSignal(true),
        visits: createSignal(3),
        status: createSignal("ready"),
    }),
    setup: (store) => ({
        actions: {
            toggle: () => {
                const [, setActive] = store.state.active;
                setActive((active) => !active);
            },
        },
    }),
});

storeModule("profile", profileModule);
```

The state factory runs for each store initialization. `setup` receives its
fully inferred state plus refs, and its returned action signatures are inferred
too. `defineStoreModule` preserves that inference when declaring a reusable
module separately before passing it to `storeModule`.

HTML-only state is still available at runtime, but TypeScript cannot infer its
shape from markup. Declare state used by `setup` in the state factory. A module
signal takes precedence over a matching state attribute and remains synchronized
with it.

Stores must have unique scope names, including when they are nested. A second
element that reuses a scope is skipped with a warning, and the directives inside
it are left unbound rather than reading the first store.

If a module's `state` factory or `setup` throws, the error is logged and the
store is still created from its HTML state, so the rest of the page keeps
working. Register store modules before calling `start`; a module registered
after its store exists only applies after `Catalyst.refresh(scope)`.

## Reaction attributes

All behavior uses the same attribute grammar:

```text
data-{reaction}
data-{reaction}--{specifier}
```

Directive values use a symbol to identify their member type:

```text
$state.path
@action
#identifier
```

The nearest `data-store` scope is inferred. State is denoted by `$`, actions by
`@`, and named references used by refs and effects are denoted by `#`. Bare
values remain literal values for custom reactions.

Prefix a reference with a scope when it needs to cross a store boundary:

```text
profile:$name
dialog:@open
form:#submitButton
```

### Bindings

`data-bind--{attribute}` reactively writes an HTML attribute from state or an
action response.

```html
<nav data-store="navigation">
    <a data-bind--href="$links[0].url">Home</a>
    <button data-bind--aria-expanded="$open">Menu</button>
    <button data-bind--disabled="$busy">Save</button>
</nav>
```

`null` and `undefined` remove the attribute. Booleans follow HTML boolean
attribute rules: `true` adds the attribute and `false` removes it, so
`data-bind--disabled="$busy"` enables the button again when `busy` is `false`.
`aria-*`, `data-*`, `contenteditable`, `draggable` and `spellcheck` attributes
receive the strings `"true"` and `"false"` instead, because their `"false"`
value is meaningful. Case-sensitive SVG attributes such as `viewBox` are written
with their correct casing.

### DOM

```html
<section data-store="profile">
    <p data-dom--text="$name"></p>
    <div data-dom--html="@renderHtml"></div>
    <input data-dom--value="$value" />
    <input data-dom--focus="$open" />
</section>
```

Supported specifiers are `text`, `html`, `value`, `focus`, `blur`, and
`scrollto`. Omitting the specifier defaults to `text`, and an unknown specifier
logs a warning. `null` and `undefined` render as empty content.

`html` writes the value as raw markup. Only use it with trusted content, and note
that markup it inserts is not synchronized automatically.

### Events

```html
<div data-store="dialog">
    <button data-events--click="@open">Open</button>
    <div data-events--document.keydown="@onKeydown"></div>
    <div data-events--window.resize="@onResize"></div>
</div>
```

Element events receive the `Event` as the action's first argument. Events can
also target `document`, `body`, `head`, or `window`. HTML lowercases attribute
names, so an event name containing uppercase letters, such as `DOMContentLoaded`
or a camelCase custom event, cannot be listened to; give custom events lowercase
or kebab-case names.

### Refs

```html
<form data-store="form">
    <button data-ref="#submitButton">Submit</button>
    <input data-ref="#fields[]" />
</form>
```

```ts
const button = store.refs.get("submitButton");
const fields = store.refs.get("fields");
```

Refs are registered before the store's optional `init` action runs.

### Effects

Manual effects are activated with `data-effects`:

```html
<div data-store="dialog">
    <div data-effects="#onOpenChange"></div>
</div>
```

Store effects follow Solid 2's two-phase `createEffect`. `compute` is tracked,
so every signal it reads re-runs the effect. `effect` receives the computed
value and runs untracked; it is where side effects belong, and it may return a
cleanup function that runs before the next run and when the effect is disposed.

```ts
import { createSignal, defineEffect, storeModule } from "@lucidclient/catalyst";

storeModule("dialog", {
    state: () => ({ open: createSignal(false) }),
    setup: (store) => ({
        actions: {},
        effects: {
            manual: {
                onOpenChange: defineEffect({
                    compute: () => store.state.open[0](),
                    effect: (open, { isInitial, previous }) => {
                        console.log(open, isInitial, previous);
                    },
                }),
            },
            global: {
                analytics: {
                    compute: () => store.state.open[0](),
                    effect: (open) => {
                        const timer = setTimeout(() => {
                            console.log("Dialog open state settled", open);
                        }, 500);
                        return () => clearTimeout(timer);
                    },
                },
            },
        },
    }),
});
```

TypeScript cannot infer an inline effect's value through `setup`'s return type,
so an inline `effect` receives an untyped value. Wrap the effect in
`defineEffect` to have its value typed from `compute`.

Global effects run whenever the effects reaction is registered. Duplicate
references to the same store effect share one reactive effect. An effect that
throws is logged and does not stop other effects from running.

### Loops

`data-loop` resolves an array and renders its direct `<template>` child once per
item.

```html
<nav data-store="navigation">
    <ul data-loop="$links">
        <template>
            <li>
                <a
                    data-bind--href="$item.url"
                    data-bind--data-index="$index"
                    data-dom--text="$item.title"
                ></a>
            </li>
        </template>
    </ul>
</nav>
```

Each rendered template receives `$item`, `$index`, and `$indexOne`. Nested loops
can access their enclosing context through `$parent.item`, `$parent.index`, and
`$parent.indexOne`. Parent traversal can be repeated for deeper nesting, for
example `$parent.parent.item`.

Rendered items are matched to array items by identity. When the array changes,
items that are still present keep their markup, listeners and form state, and
only move or update `$index`; new items are rendered and removed items are
disposed. Replacing every object (for example with freshly parsed JSON) renders
every item again. `null` and `undefined` render nothing, and any markup inside
the loop element other than its `<template>`, such as server-rendered
placeholders, is replaced on the first render.

```html
<ul data-loop="$groups">
    <template>
        <li>
            <h2 data-dom--text="$item.title"></h2>
            <ul data-loop="$item.links">
                <template>
                    <li>
                        <a
                            data-bind--href="$item.url"
                            data-bind--data-group="$parent.item.title"
                            data-dom--text="$item.title"
                        ></a>
                    </li>
                </template>
            </ul>
        </li>
    </template>
</ul>
```

### Focus traps

```html
<div data-store="dialog">
    <button data-events--click="@open">Open</button>
    <div data-trap="$open">
        <button data-events--click="@close">Close</button>
    </div>
</div>
```

While the value is truthy, everything outside the trap is made inert at every
level of the page, page scrolling is locked, and focus moves to the trap's first
`[autofocus]` or focusable element (or to the trap itself). When it closes,
focus returns to the element that was focused before. Elements that were already
inert are left as they were.

Traps can be stacked: opening a second trap makes the first inert, and closing it
restores the first trap and its focus.

`both` traps the element while true and makes the target inert while false.

Elements marked `data-trap-allow` stay interactive while a trap is active, which
suits a menu toggle that sits outside the menu it opens:

```html
<header data-store="nav">
    <button data-events--click="@toggle" data-trap-allow>Menu</button>
    <nav data-trap--both="$open">…</nav>
</header>
```

## Dynamic markup and lifecycle

Use `sync` after adding markup outside Catalyst:

```ts
target.innerHTML = `<button data-events--click="@select">Select</button>`;
Catalyst.sync(target);
```

Repeated synchronization is idempotent. Removed subtrees automatically dispose
their event listeners, reactive effects, refs, and nested stores. Markup that is
removed and inserted again later needs another `sync`. Directives that reference
a store before it exists are initialised once a `sync` creates that store.

```ts
Catalyst.refresh();
Catalyst.refresh("storeScope");
Catalyst.destroy();
```

`refresh` rebuilds a store, or every store, from scratch. Directives elsewhere
on the page that reference a rebuilt store, such as `dialog:$open`, are bound to
the new store. `destroy` resets the running instance so it can be started again,
even if a store's cleanup throws. Registered store modules and reaction
definitions remain available.

`sync` and `refresh` activate every directive in their target, including ones in
markup you did not write. HTML sanitizers such as DOMPurify keep `data-*`
attributes by default, so sanitize user content with those attributes removed, or
keep it outside the areas you synchronize, otherwise it could wire up your
actions.

## Configuration

```ts
Catalyst.start({
    debug: true,
    reactions: [events, dom],
    attributes: {
        prefix: "data-",
        store: "store",
        state: "state--",
        scopeSeparator: ":",
        specifierSeparator: "--",
    },
});
```

Reaction attribute names are owned by their reaction definitions rather than by
core configuration.

## Custom reactions

Custom reactions receive the same concrete directive data as Catalyst's
first-party reactions:

```ts
import Catalyst, { registerReaction } from "@lucidclient/catalyst";
import type { Reaction } from "@lucidclient/catalyst/types";

const classList: Reaction = {
    name: "classList",
    attribute: "class-list",
    setup: ({ element, value }) => {
        element.classList.add(value);
        return () => element.classList.remove(value);
    },
};

registerReaction(classList);
Catalyst.start();
```

```html
<div data-class-list="is-active"></div>
```

Because `is-active` has no `$`, `@`, or `#` prefix, it remains a literal value
and `directive.reference` is `null`. A reaction can alternatively be passed
through `Catalyst.start({ reactions })`.

`setup` runs inside a Solid root that Catalyst disposes with the directive, so
reactive primitives created there are cleaned up automatically. It must not
write signals. Use Solid 2's two-phase `createEffect(compute, effect)` for
reactive work, and keep the `effect` callback from throwing or returning
anything other than a cleanup function, since either halts Solid's reactivity.
