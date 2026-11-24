# Catalyst

> Part of the Lucid Client suite - documentation coming soon

A lightweight reactive UI library that connects HTML attributes to typed JavaScript stores. Your logic stays in TypeScript, and your markup says where it's used. Powered by SolidJS.

## Features

- Typed Stores: State, computed values and actions, with types inferred for you.
- Attribute Driven: Bind text, attributes, classes, events and more with `data-*` attributes.
- Only What You Use: Register just the reactions your app needs.
- Loops and Conditionals: Render lists and show or hide markup from state.
- Persisted State: Keep state across page loads.
- Animations: View transitions and animated showing and hiding.
- Custom Reactions: Add attributes of your own.

## Installation

```bash
npm install @lucidclient/catalyst
```

## Usage

```typescript
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

Catalyst.init({
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

State and computed values are read with `$name`, and actions are called with `@name`.
