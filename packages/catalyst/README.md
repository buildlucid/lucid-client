# Catalyst

> Part of the Lucid Client suite

A lightweight reactive UI library that connects HTML attributes to typed
JavaScript stores. Catalyst uses SolidJS for reactivity while keeping
application logic out of markup.

## Installation

```bash
npm install @lucidclient/catalyst
```

## Getting started

```ts
import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { dom, events } from "@lucidclient/catalyst/reactions";

const counter = defineStore({
    state: { count: 0 },
    computed: ({ state }) => ({
        double: () => state.count * 2,
    }),
    actions: ({ setState }) => ({
        increment: () =>
            setState((state) => {
                state.count += 1;
            }),
    }),
});

Catalyst.start({
    stores: { counter },
    reactions: [events, dom],
});
```

```html
<div data-store="counter">
    <button data-events--click="@increment">
        Count: <span data-dom--text="$count"></span>
        (double: <span data-dom--text="$double"></span>)
    </button>
</div>
```

Each key of a store maps to the markup: `state` and `computed` values are read
with `$name`, actions are called with `@name`, and elements are registered as
refs with `#name`.

Reactions are registered explicitly, so an application only includes the
behavior it uses. Catalyst exports `bind`, `dom`, `events`, `loop`, `model` and
`trap` from `@lucidclient/catalyst/reactions`. Refs and store effects are part of the
core and need no reaction.

`start` waits for `DOMContentLoaded` when it runs before `<body>` exists, and
returns with every binding applied.

## Stores

`defineStore` declares a store. Every key is optional, and state, computed
values and actions are inferred from the definition, so no generic types are
needed:

```ts
import { defineStore } from "@lucidclient/catalyst";

type Link = { title: string; url: string };

export const nav = defineStore({
    state: {
        open: false,
        links: [] as Link[],
    },
    computed: ({ state }) => ({
        buttonLabel: () => (state.open ? "Close menu" : "Open menu"),
    }),
    actions: ({ state, setState, refs }) => ({
        toggle: () =>
            setState((draft) => {
                draft.open = !draft.open;
            }),
        addLink: (link: Link) =>
            setState((draft) => {
                draft.links.push(link);
            }),
        focusSearch: () => refs.get<HTMLInputElement>("search")?.focus(),
        logLinks: () => console.log(state.links.length),
    }),
    effects: ({ state, actions, effect }) => ({
        focusWhenOpened: effect(
            () => state.open,
            (open) => {
                if (open) actions.focusSearch();
            },
        ),
    }),
    init: ({ refs }) => {
        const observer = new ResizeObserver(() => {});
        const menu = refs.get("menu");
        if (menu) observer.observe(menu);
        return () => observer.disconnect();
    },
});
```

Register stores when starting Catalyst. Each key is the `data-store` scope the
definition applies to:

```ts
Catalyst.start({
    stores: { nav },
    reactions: [bind, dom, events],
});
```

A definition can be registered under several scopes, and each scope gets its own
state: `stores: { loginDialog: dialog, signupDialog: dialog }`. Every element
with `data-store` gets a store, with or without a definition, so markup-only
state works too.

### State

`state` is a plain object of starting values. It is copied for every store, so
a refreshed store starts from its defaults again. Use a function that returns
the object for values that can't be copied, such as functions or class
instances: `state: () => ({ map: new Map() })`.

State is a Solid store. Read it directly, `state.open`, and write it through
the `setState` draft, which can be changed in place:

```ts
setState((state) => {
    state.open = true;
    state.links.push({ title: "Home", url: "/" });
    state.links[0].title = "Start";
});
```

Changing nested data updates exactly the bindings that read it, including
loops. `state` is read-only, so a direct write such as `state.open = true` is a
type error and is ignored with a warning at runtime.

Give a type where the starting value is narrower than the values it will hold,
for example `links: [] as Link[]` or `user: null as User | null`.

### Computed values

`computed` values are derived from state, are read with `$name` in markup like
state, and appear on `state` in actions, effects and `init`. Each one is only
recomputed when the state it reads changes. Computed values are read-only; give
one a different name from any state value.

### Actions

Actions are the functions markup calls with `@name`. Events pass the `Event` as
the first argument, and an action can return a value for bindings such as
`data-dom--text="@label"`, though a computed value is usually the clearer
choice for that. Actions receive `state`, `setState` and `refs`.

### Effects

Store effects run for as long as the store exists, starting after `init`.
Create each one with the `effect` helper, which follows Solid 2's two-phase
`createEffect`: the first function is tracked, so every state value it reads
re-runs the effect, and the second receives its result untracked and is where
side effects belong.

```ts
effects: ({ state, effect }) => ({
    saveDraft: effect(
        () => state.draft,
        (draft, { isInitial, previous }) => {
            if (isInitial) return;
            const timer = setTimeout(() => save(draft, previous), 500);
            return () => clearTimeout(timer);
        },
    ),
}),
```

The callback's value is typed from the tracked function. It may return a cleanup
function, which runs before the next run and when the store is destroyed. The
callback runs untracked, so it can read any other state without re-running when
that state changes. An effect that throws, in either function or its cleanup, is
logged with its name and does not stop other effects from running.

### Init and cleanup

`init` runs once the store's refs are registered, and can write state. Return a
function to clean up when the store is destroyed, so setup and teardown share
the same variables. An async `init` can return a cleanup too.

### Refs

```html
<form data-store="form">
    <button data-ref="#submitButton">Submit</button>
    <input data-ref="#fields[]" />
</form>
```

```ts
const button = refs.get<HTMLButtonElement>("submitButton");
const fields = refs.all<HTMLInputElement>("fields");
```

`refs.get` returns the element, or the first element of a `[]` ref, and
`refs.all` returns every element registered under the name. Both accept the
element type you expect, and default to `HTMLElement`.

### State attributes

`data-state--*` attributes on the store element declare state in markup and stay
synchronized with it in both directions:

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

An attribute sets the state's starting value, so server-rendered values are
kept. When the definition declares the same state, its value is the default and
its type decides how the attribute is parsed: with `visits: 0`, the attribute
`"3"` becomes the number `3`, and with `code: ""`, `"42"` stays a string. State
the definition declares without an attribute is not written to the element.

Attribute names are kebab-case and map to camelCase state keys, as `dataset`
does: `data-state--user-name` is the `userName` state, referenced as
`$userName`. HTML lowercases attribute names, so `data-state--userName` cannot
match `userName`; Catalyst warns when it finds that mismatch.

Without a definition, values are inferred without loss. `true`, `false`,
`null`, numbers that convert back to the same text, and JSON objects or arrays
become typed values; anything else stays a string, so `""`, `"007"` and long
numeric ids are kept as written. Once a state value has a type it keeps it: when
the attribute changes, a string state stays a string even if the new value looks
numeric. Removing a state attribute sets its state to `null` without recreating
the attribute.

An attribute added later for state the definition declares is kept in sync both
ways straight away. An attribute for undeclared state is picked up by the next
`sync`.

### Stores and scopes

Stores must have unique scope names, including when they are nested. A second
element that reuses a scope is skipped with a warning, and the directives inside
it are left unbound, so its markup stays as it was rendered rather than reading
the first store.

If any part of a definition throws, the error is logged and the store is still
created from its HTML state, so the rest of the page keeps working.

Stores loaded after `start`, for example from a code-split module, are added
with `Catalyst.add`. A store whose element is already on the page is rebuilt
with its definition:

```ts
const { cart } = await import("./stores/cart");
Catalyst.add({ stores: { cart } });
```

## Reactivity

Catalyst is built on Solid 2 and re-exports `flush`, `untrack` and `snapshot`
from `solid-js`. Two Solid 2 rules apply to stores:

- State writes are batched until the next microtask. Reading state straight
  after writing it returns the previous value; call `flush()` first if an action
  needs the new value immediately.
- State cannot be written while a reactive value is being computed, so write it
  from actions, effect callbacks or `init`, not from a computed value or the
  tracked function of an effect.

`snapshot(state.links)` returns the plain value behind a piece of state without
tracking it, which is useful for logging or sending it elsewhere. Treat it as
read-only, since it can be the store's own object.

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

The nearest `data-store` scope is inferred. State and computed values are
denoted by `$`, actions by `@`, and refs by `#`. Bare values remain literal
values for custom reactions.

Prefix a reference with a scope when it needs to cross a store boundary:

```text
profile:$name
dialog:@open
form:#submitButton
```

In debug mode, Catalyst warns when markup uses a first-party reaction, such as
`data-loop`, that isn't registered.

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

`data-bind--checked` and `data-bind--value` set attributes, which are only a
field's defaults and stop applying once someone edits the field. Use
`data-dom--checked`, `data-dom--value` or `data-model` to set what a field
shows.

### DOM

```html
<section data-store="profile">
    <p data-dom--text="$name"></p>
    <div data-dom--html="@renderHtml"></div>
    <input data-dom--value="$value" />
    <input type="checkbox" data-dom--checked="$subscribed" />
    <input data-dom--focus="$open" />
</section>
```

Supported specifiers are `text`, `html`, `value`, `checked`, `focus`, `blur`,
and `scrollto`. Omitting the specifier defaults to `text`, and an unknown
specifier logs a warning. `null` and `undefined` render as empty content.

`value` and `checked` set what a field shows, and are one-way: an edit only
reaches state through an action, or use `data-model` for two-way binding. An
array selects every matching option of a `<select multiple>`. A select's value
is applied again whenever its options change, so it still selects an option
that a loop renders afterwards.

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

### Two-way binding

`data-model` keeps a form field and state in sync both ways: the field shows the
state, and the state follows the field as it is edited.

```html
<form data-store="signup">
    <input name="email" data-model="$email" />
    <input type="number" data-model="$seats" />
    <input type="checkbox" data-model="$terms" />
    <input type="radio" value="pro" data-model="$plan" />
    <input type="checkbox" value="news" data-model="$topics" />
    <select multiple data-model="$tags">…</select>
</form>
```

- Text fields and textareas write a string on every `input` event. Number and
  range fields write a number, or `null` when they are empty.
- A checkbox writes `true` or `false`. Checkboxes bound to an array write the
  values of the checked ones, and keep any value no checkbox represents.
- A radio writes its `value` when it is chosen.
- A select writes its value, and a `<select multiple>` writes an array.
- Values keep the type of the state they replace, so a select bound to a number
  writes a number.
- After a native form reset, state follows the reset fields.

`data-model` writes state the store declares, or a property of a loop item, such
as `data-model="$item.qty"`, which is written to the store the loop renders.
Computed values can't be written.

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
disposed. Changing the array in place, such as
`setState((state) => { state.links.push(link); })`, keeps every other item's
markup, and editing an item's field only updates the bindings that read it.
Replacing every object (for example with freshly parsed JSON) renders every item
again. `null` and `undefined` render nothing, and any markup inside the loop
element other than its `<template>`, such as server-rendered placeholders, is
replaced on the first render.

Actions called from inside a loop item receive the item: an event action gets
it after the `Event`, and an action that provides a value gets it as its only
argument. Reading `index` in a value keeps it up to date as the item moves.

```ts
import type { LoopItem } from "@lucidclient/catalyst/types";

actions: ({ setState }) => ({
    remove: (event: Event, { index }: LoopItem) =>
        setState((state) => {
            state.lines.splice(index, 1);
        }),
    amount: ({ item }: LoopItem<Line>) => format(item.qty * item.price),
}),
```

```html
<li>
    <span data-dom--text="@amount"></span>
    <button data-events--click="@remove">Remove</button>
</li>
```

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
`[autofocus]` or focusable element (or to the trap itself). Focus moves once the
rest of the update has run, so a binding that shows the trap, such as
`data-bind--hidden`, applies first wherever it is in the markup. When it closes,
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
removed and inserted again later needs another `sync`. A store can be replaced
by removing its markup and syncing the new markup straight away.

Directives that reference a store before it exists, such as
`data-dom--text="cart:$count"`, are left as they are until a `sync` creates that
store, then bind to it. When the store is removed they wait for a new one, keeping
what they last showed. `data-state--*` attributes added to an existing store's
element for undeclared state are picked up by the next `sync`.

```ts
Catalyst.refresh();
Catalyst.refresh("storeScope");
Catalyst.destroy();
```

`refresh` rebuilds a store, or every store, from scratch. Directives elsewhere
on the page that reference a rebuilt store, such as `dialog:$open`, are bound to
the new store. `destroy` resets the running instance so it can be started again,
even if a store's cleanup throws. Registered stores and reactions remain
available, so `Catalyst.start()` can be called again without them.

`sync` and `refresh` activate every directive in their target, including ones in
markup you did not write. HTML sanitizers such as DOMPurify keep `data-*`
attributes by default, so sanitize user content with those attributes removed, or
keep it outside the areas you synchronize, otherwise it could wire up your
actions.

## Configuration

```ts
Catalyst.start({
    debug: true,
    stores: { nav, counter },
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
import Catalyst from "@lucidclient/catalyst";
import type { Reaction } from "@lucidclient/catalyst/types";

const classList: Reaction = {
    name: "classList",
    attribute: "class-list",
    setup: ({ element, value }) => {
        element.classList.add(value);
        return () => element.classList.remove(value);
    },
};

Catalyst.start({ reactions: [classList] });
```

```html
<div data-class-list="is-active"></div>
```

Because `is-active` has no `$`, `@`, or `#` prefix, it remains a literal value
and `directive.reference` is `null`. `context.resolve(reference)` reads a
reference's value, and `context.getStore(scope)` returns a store's `key`,
`element`, `state`, `setState`, `actions` and `refs`.

Each reaction needs its own name and attribute. A reaction that reuses either is
not registered, and Catalyst warns.

`setup` runs inside a Solid root that Catalyst disposes with the directive, so
reactive primitives created there are cleaned up automatically. It must not
write state. Use Solid 2's two-phase `createEffect(compute, effect)` from
`solid-js` for reactive work, and keep the `effect` callback from throwing or
returning anything other than a cleanup function, since either halts Solid's
reactivity.
