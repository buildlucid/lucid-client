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
behavior it uses. Catalyst exports `bind`, `classes`, `conditional`, `css`,
`dom`, `events`, `intersect`, `loop`, `model`, `trap` and `uid` from
`@lucidclient/catalyst/reactions`. Refs and store effects are part of the core
and need no reaction.

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

State is reactive. Read it directly, `state.open`, and write it through the
`setState` draft, which can be changed in place:

```ts
setState((state) => {
    state.open = true;
    state.links.push({ title: "Home", url: "/" });
    state.links[0].title = "Start";
});
```

Changing nested data updates exactly the bindings that read it, including
loops. `state` is read-only, so a direct write such as `state.open = true` is a
type error and is ignored with a warning at runtime, as is a nested write such
as `state.links[0].title = "Start"` outside `setState`.

Plain objects and arrays in state are reactive. Other values, such as functions,
class instances, `Map`s and promises, are stored as they are, so changing their
contents doesn't update anything: replace the value with `setState` instead.

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

`init` runs once the store's refs are registered, and can write state. Refs
inside a loop or a `data-if` register when that markup renders, after `init`,
so read them in an action or effect instead. Return a
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

### Persisted state

Wrap a state value in `persisted()` to save it to storage and restore it when
the page loads again. Persistence is imported from its own entry point, so pages
that don't persist state don't include it. Pass `persistence()` to `start` to
turn it on:

```ts
import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { persisted, persistence } from "@lucidclient/catalyst/persistence";

type Theme = "light" | "dark";

export const prefs = defineStore({
    state: {
        theme: persisted("light" as Theme),
        sidebarOpen: persisted(true),
        draft: persisted("", { storage: "session" }),
        busy: false,
    },
});

Catalyst.start({
    stores: { prefs },
    persistence: persistence(),
});
```

Without `persistence()`, persisted values still work as ordinary state, but
aren't saved, and the development build warns.

`state.theme` is typed as `Theme`, not as a wrapper. `persisted()` works on
top-level state values, including in a state function.

Markup persists state with `data-persist`, which lists state keys as they are
written in `$name`. The specifier chooses the storage, and without one the
default storage is used:

```html
<div
    data-store="prefs"
    data-state--theme="light"
    data-state--sidebar-open="true"
    data-state--draft=""
    data-persist="theme sidebarOpen"
    data-persist--session="draft"
></div>
```

This works for stores without a definition. On a store with one, markup can
persist more keys and choose their storage for that store only, so a `dialog`
registered under two scopes can persist just one of them.

The order of starting values is: the definition's default, then the
`data-state--*` attribute, then the stored value. A stored value wins, because
restoring what the user chose is the point, and the attribute is then updated to
match it. Don't persist values the server owns, such as a cart count, because a
stored copy goes stale.

Values are restored before the store is created, so bindings, `init` and effects
see them from the start. A value is only saved once it changes, so users who
never changed a setting pick up a new default when you change it in code.
Changing nested data, such as pushing to an array, is saved too. Setting a value
to `undefined` removes it from storage.

A stored value is ignored when its type doesn't match the starting value's, such
as a string where the state starts as a boolean, so data saved by an older
version of the page doesn't break it. `null` matches any type. Use `validate`
for anything more specific:

```ts
theme: persisted("light" as Theme, {
    validate: (value) => value === "light" || value === "dark",
}),
```

`persisted()` takes these options:

- `storage`: `"local"`, `"session"` or the name of a registered adapter.
  Defaults to the `storage` option of `persistence()`.
- `key`: the storage entry's name after the prefix. Defaults to `{scope}:{key}`,
  such as `catalyst:prefs:theme`, so each scope saves its own value.
- `validate`: returns `false` to ignore a stored value.
- `sync`: applies changes saved by other tabs. Defaults to the `sync` option of
  `persistence()`.

Values must be plain data that JSON can represent. A `Map`, a class instance or
a function logs a warning and isn't persisted. When storage is blocked or full,
Catalyst warns once and the state keeps working without being saved.

Persistence is decided when a store is created, so a changed `data-persist`
attribute applies after `Catalyst.refresh(scope)`. A refreshed store restores its
stored values again. `clearPersisted(scope)`, from
`@lucidclient/catalyst/persistence`, removes a running store's saved values, or
every running store's without a scope, such as when a user logs out. State keeps
its current values and is saved again the next time it changes.

Server-rendered markup shows its own values until Catalyst starts. For a value
that must not flash, such as a theme, save it in a cookie with an adapter so the
server can render it, or apply it with an inline script in `<head>`.

#### Storage adapters

`local` and `session` save JSON to `localStorage` and `sessionStorage`. Register
other storage as an adapter:

```ts
import type { StorageAdapter } from "@lucidclient/catalyst/types";

const memory = new Map<string, unknown>();
const memoryAdapter: StorageAdapter = {
    get: (key) => memory.get(key),
    set: (key, value) => memory.set(key, value),
    remove: (key) => memory.delete(key),
};

Catalyst.start({
    stores: { prefs },
    persistence: persistence({
        prefix: "catalyst:",
        storage: "local",
        sync: false,
        adapters: { memory: memoryAdapter },
    }),
});
```

`prefix`, `storage` and `sync` set the defaults for every persisted value, and
are shown here with their default values.

```html
<div data-store="cart" data-state--open="false" data-persist--memory="open"></div>
```

Adapters receive values as they are and decide how to encode them. `get` returns
`undefined` when nothing is stored, `set` is never passed `undefined`, and the
optional `subscribe(key, onChange)` reports changes made elsewhere when sync is
on, with `undefined` for a removed value, which resets the state to its starting
value. HTML lowercases attribute names, so give adapters used in markup
lowercase names. Adapters are read synchronously, because values are restored
before the store is created.

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

Catalyst is built on Solid 2's signals, and re-exports `flush` and `untrack`
from `solid-js`. Store state follows the same two rules as Solid 2's signals:

- State writes are batched until the next microtask. Reading state straight
  after writing it returns the previous value; call `flush()` first if an action
  needs the new value immediately.
- State cannot be written while a reactive value is being computed, so write it
  from actions, effect callbacks or `init`, not from a computed value or the
  tracked function of an effect.

`snapshot(state.links)`, exported by Catalyst, returns the plain value behind a
piece of state without tracking it, which is useful for logging or sending it
elsewhere. Treat it as read-only, since it is the store's own object.

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

`data-bind--class` replaces the whole `class` attribute, so use `data-class` to
add and remove classes. `data-bind--hidden` hides an element through the
browser's `[hidden] { display: none }` style, which any `display` rule of your
own overrides, such as a `flex` class. Add `[hidden] { display: none !important; }`
to your stylesheet so hidden always wins.

### Classes

`data-class--{name}` adds the `{name}` class while the value is truthy and
removes it while it is falsy. `data-class` applies a list of classes from a
string, an array of strings, or an object whose truthy keys are applied, which
suits a computed value or a loop item's action:

```html
<nav data-store="menu">
    <button class="toggle" data-class--is-open="$open">Menu</button>
    <ul data-loop="$links">
        <template>
            <li class="link" data-class="@linkClass" data-dom--text="$item.title"></li>
        </template>
    </ul>
</nav>
```

```ts
actions: ({ state }) => ({
    linkClass: ({ item }: LoopItem<Link>) => ({
        "font-semibold text-accent": item.url === state.current,
    }),
}),
```

`data-class` only removes classes it added, so classes the markup already had
stay, even when the value stops naming them. Use `data-class--{name}` for a
class the server may render that should still be removed, since it owns its one
class. When either directive is disposed, the classes it changed go back to how
the markup had them. HTML lowercases attribute names, so
`data-class--{name}` can only set lowercase class names without `.`; use
`data-class` for any other name, such as utility classes like `w-1/2`.

### CSS variables

`data-css--{name}` reactively sets the `--{name}` custom property on the element
from state, a computed value, an action response or a loop value, so state can
drive styles that stay in your stylesheets.

```html
<div data-store="player" data-css--progress="$percent">
    <div class="bar"></div>
    <ul data-loop="$tracks">
        <template>
            <li data-css--index="$index" data-dom--text="$item.title"></li>
        </template>
    </ul>
</div>
```

```css
.bar {
    width: calc(var(--progress) * 1%);
}
li {
    animation-delay: calc(var(--index) * 50ms);
}
```

Strings and numbers are written as they are, so add units in CSS with `calc()`.
Booleans are written as `true` and `false`, which style queries such as
`@container style(--open: true)` can match. `null`, `undefined` and an empty
string remove the property, so `var(--name, fallback)` uses its fallback. Objects
and arrays have no CSS value, so they remove the property and log a warning.

HTML lowercases attribute names, so use lowercase kebab-case custom property
names: `data-css--accentColor` sets `--accentcolor`, not `--accentColor`. Names
can't contain `.`.

Other inline styles are left alone. When the directive is disposed, for example
because its attribute was removed before a `sync`, the property goes back to the
inline value the element had before, such as a server-rendered
`style="--progress: 30%"`, or is removed. `data-bind--style` replaces the whole
`style` attribute, including these properties, so don't use both on one element.

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

`outside` listens for an event anywhere outside the element, which suits
closing a menu or popup. Put it on the element that holds both the menu and the
button that opens it, so the button's own click isn't outside:

```html
<div data-store="menu" data-events--outside.click="@close">
    <button data-events--click="@toggle">Menu</button>
    <ul data-bind--hidden="$closed">…</ul>
</div>
```

Events that start while the element is hidden aren't outside it, so a popup
that listens for them itself can sit beside the button that opens it: the click
that opens it doesn't close it again. The action runs once the event has bubbled
to `document`, after the clicked element's own actions, so an event stopped
before it gets there isn't seen.

#### Modifiers

Modifiers follow the event name, separated by dots, and can be combined:

```html
<form data-events--submit.prevent="@save">…</form>
<div data-events--document.keydown.escape="@close"></div>
<input data-events--input.debounce.300ms="@search" />
<button data-events--click.once="@load">Load more</button>
```

- `prevent` and `stop` call `preventDefault()` and `stopPropagation()`.
- `once` calls the action the first time only.
- `self` only calls it when the event happened on the element itself, not a
  child.
- `passive` and `capture` set the listener options of the same names.
- `debounce` waits until the events stop for 250ms, then calls the action with
  the last event. `throttle` calls it at most once every 250ms. Both take a
  duration such as `500ms` or `1s`.
- `transition` calls the action in a [view transition](#view-transitions).
- `shift`, `ctrl`, `alt` and `meta` only call the action while that key is
  held, such as `click.shift` or `keydown.ctrl.k`.
- On `keydown` and `keyup`, any other modifier is a key name, and the action
  only runs for those keys. Names are the event's `key` in kebab-case:
  `escape`, `enter`, `space`, `tab`, `arrow-down`, `k`.

Modifiers filter the event first, then `prevent` and `stop` apply straight
away, even when the action is debounced, throttled or run in a transition. An
action that runs after the event, such as a debounced one, receives an event
whose `currentTarget` is `null`, so read `event.target` or a ref instead.

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
- After a native form reset, state follows the reset fields. A radio group
  with no default choice sets its state to `null`.

`data-model` writes state the store declares, or a property of a loop item, such
as `data-model="$item.qty"`, which is written to the store the loop renders.
Computed values can't be written.

Modifiers change when a text field writes:

```html
<input data-model--lazy="$name" />
<input data-model--trim="$email" />
<input type="search" data-model--debounce.300ms="$query" />
```

- `lazy` writes when the field changes, such as when it loses focus, instead
  of as it is typed in.
- `trim` writes the text without spaces at either end. The field keeps what was
  typed until it changes, then shows the trimmed text.
- `debounce` writes once typing pauses for 250ms, or for a duration such as
  `500ms`, and straight away when the field changes or its form is submitted.

#### Dialogs, popovers and details

`data-model` also opens and closes a `<dialog>`, a `popover` element or a
`<details>` from boolean state, and writes `false` when the browser closes it,
such as on `Escape`, a click outside a popover or a `<form method="dialog">`:

```html
<div data-store="confirm">
    <button data-events--click="@open">Delete</button>
    <dialog data-model="$open">
        <form method="dialog">
            <button>Cancel</button>
            <button data-events--click="@delete">Delete</button>
        </form>
    </dialog>
</div>
```

A dialog opens as a modal with `showModal()`, so the page behind it is inert,
focus moves inside and `Escape` closes it, without a `data-trap`. Popovers use
`showPopover()` and `hidePopover()`, and a details element its `open` property.

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

Whitespace around the template's element that includes a line break, such as
its indentation, isn't rendered, so items sit next to each other. Whitespace on
one line is kept: `<template> <span>…</span> </template>` renders a space either
side of each item.

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

### Conditional rendering

`data-if` renders its direct `<template>` child while the value is truthy, and
removes it, with its listeners, effects and stores, while it is falsy. It
suits markup that is expensive or shouldn't exist while it's hidden, such as a
heavy widget or form fields that shouldn't submit:

```html
<div data-store="checkout">
    <div data-if="$needsInvoice">
        <template>
            <fieldset>
                <input name="company" data-model="$company" />
            </fieldset>
        </template>
    </div>
</div>
```

The template can hold any number of elements. Rendered markup is created
afresh each time, so field values and listeners don't carry over. Any markup
inside the element other than its `<template>` is replaced on the first render,
as with loops. To hide markup while keeping it, use `data-bind--hidden`.

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

### Visibility

`data-intersect` calls an action when the element scrolls into view, with the
`IntersectionObserverEntry` as its first argument. `data-intersect--leave`
calls it when the element scrolls out of view again:

```html
<div data-store="feed">
    <img data-src="/photo.jpg" data-intersect--once.200px="@loadImage" />
    <video data-intersect="@play" data-intersect--leave="@pause"></video>
    <div data-intersect="@loadMore"></div>
</div>
```

- `once` stops after the first call.
- `half` waits until half of the element is visible, and `full` until all of
  it is, allowing for rounding at 99%. An element taller than the viewport
  never becomes fully visible.
- A length such as `200px` or `10%` grows the viewport by that much on every
  side, so the action runs before the element scrolls into view.

Elements with the same modifiers share one `IntersectionObserver`.

### Unique ids

`data-uid="{name}"` gives an element a generated id, and
`data-uid--{attribute}="{name}"` writes the same id to another attribute, such
as `for`, `aria-controls`, `aria-labelledby` or `popovertarget`. Each loop item
and store gets its own ids, so markup inside a loop needs no index:

```html
<ul data-loop="$questions">
    <template>
        <li>
            <button data-uid--aria-controls="answer" data-dom--text="$item.question"></button>
            <div data-uid="answer" data-dom--text="$item.answer"></div>
        </li>
    </template>
</ul>
```

Names belong to the nearest loop item or store, or to the page outside them.
Several names separated by spaces write several ids, for attributes that take a
list such as `aria-describedby`.

## Animations

### View transitions

The [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
animates the page from how it looks before a change to how it looks after it.
Wrap the state change in `viewTransition`, exported by Catalyst:

```ts
import { defineStore, viewTransition } from "@lucidclient/catalyst";

const gallery = defineStore({
    state: { photos: [] as Photo[] },
    actions: ({ setState }) => ({
        shuffle: () =>
            viewTransition(() =>
                setState((state) => {
                    state.photos.sort(() => Math.random() - 0.5);
                }),
            ),
    }),
});
```

From markup, the `transition` event modifier does the same for any action:
`data-events--click.transition="@remove"`. Its transition's type is the
action's store scope, such as `gallery`.

Catalyst applies the change to the page inside the transition, so the browser
captures the page after it. The browser cross-fades the page by default, and
elements with a `view-transition-name` move from their old position to their
new one. Loops keep each item's element while it stays in the array, so
`view-transition-name: match-element` animates items as they are added,
removed and reordered, without a name for each:

```css
.photo {
    view-transition-name: match-element;
}
```

Replacing every item with new objects, such as freshly parsed JSON, renders new
elements, which cross-fade rather than move. A name must be a CSS identifier, so
to name items yourself use a prefixed value such as `photo-42` through
`data-css`, not a bare number.

`viewTransition` returns the browser's `ViewTransition`, so you can wait for
`finished` or call `skipTransition()`. `types` sets
[transition types](https://developer.mozilla.org/en-US/docs/Web/CSS/:active-view-transition-type)
for CSS to match: `viewTransition(next, { types: ["forward"] })`.

A transition covers the whole page: every element with a `view-transition-name`
animates, and the rest of the page cross-fades. To animate only the part of the
page that changed, name elements only during their own transitions, and turn
off the page's cross-fade:

```css
:active-view-transition-type(gallery) .photo {
    view-transition-name: match-element;
}
::view-transition-old(root),
::view-transition-new(root) {
    animation: none;
}
```

Browsers without transition types then change the page without animating it.

- The change runs once the browser has captured the page, a frame later, so
  state read straight after calling `viewTransition` still has its old value.
  Read it after `await transition?.updateCallbackDone`.
- Only the changes made before `update` returns are animated. For an async
  action, call `viewTransition` once its data has loaded.
- The page doesn't respond to clicks while a transition runs, and starting
  another skips to the end of the current one, so keep transitions short.
- Without browser support, or when the user prefers reduced motion, the change
  is applied straight away without a transition and nothing is returned.

### Showing and hiding

Elements shown and hidden with `data-bind--hidden`, `data-class` or `data-css`
can animate with CSS alone. `@starting-style` sets where an element animates in
from, and `transition-behavior: allow-discrete` keeps it visible while it
animates out:

```css
.panel {
    transition:
        opacity 200ms,
        translate 200ms,
        display 200ms allow-discrete;
}
.panel[hidden] {
    display: none !important;
    opacity: 0;
    translate: 0 -8px;
}
@starting-style {
    .panel:not([hidden]) {
        opacity: 0;
        translate: 0 -8px;
    }
}
```

Markup that `data-if` or a loop removes leaves the page straight away, so use a
view transition to animate it out.

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

`refresh` rebuilds a store, or every store, from scratch, restoring its
persisted values from storage again. Directives elsewhere
on the page that reference a rebuilt store, such as `dialog:$open`, are bound to
the new store. `destroy` resets the running instance so it can be started again,
even if a store's cleanup throws. Registered stores and reactions remain
available, so `Catalyst.start()` can be called again without them.

`data-ignore` keeps Catalyst out of an element and everything inside it, such
as a third-party widget or markup that shows Catalyst's own attributes as code.
Nothing inside it is bound, including stores, and a `sync` inside it does
nothing. In a loop or `data-if` template, put it on an element inside the
`<template>`, not on the template itself. Add it before the markup is synced: bindings that already exist stay
until the markup is removed.

`sync` and `refresh` activate every directive in their target, including ones in
markup you did not write. HTML sanitizers such as DOMPurify keep `data-*`
attributes by default, so sanitize user content with those attributes removed, or
keep it inside a `data-ignore` element or outside the areas you synchronize,
otherwise it could wire up your actions.

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
        persist: "persist",
        ignore: "ignore",
        scopeSeparator: ":",
        specifierSeparator: "--",
    },
    persistence: persistence(),
});
```

Reaction attribute names are owned by their reaction definitions rather than by
core configuration.

### Development and production builds

Catalyst ships a development build and a production build. Bundlers that
support the `development` export condition, such as Vite while developing, use
the development build, and production builds use the smaller production build.

Warnings, `debug` messages and `context.warn` from custom reactions only log in
the development build. Both builds behave the same otherwise, and errors thrown
by store code, such as an `init` that fails, are logged in both.

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
not registered, and Catalyst warns. The `carousel`, `cookie`, `form` and
`speculate` attributes are reserved for Carousel, Cookie Controller, Forms and
Speculate, so a reaction can't claim their `data-carousel--*`, `data-cookie--*`,
`data-form--*` and `data-speculate--*` markup.

`setup` runs inside a Solid root that Catalyst disposes with the directive, so
reactive primitives created there are cleaned up automatically. It must not
write state. Use Solid 2's two-phase `createEffect(compute, effect)` from
`solid-js` for reactive work, and keep the `effect` callback from throwing or
returning anything other than a cleanup function, since either halts Solid's
reactivity.
