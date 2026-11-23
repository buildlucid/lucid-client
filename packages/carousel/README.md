# Carousel

> Part of the Lucid Client suite

A carousel for your own markup and styles, built on CSS scroll snapping. The track swipes and snaps without any JavaScript. The library adds the extras: buttons, markers, looping, mouse drag, autoplay and accessibility.

## Features

- Scroll Snap First: Scrolling and snapping are the browser's own. Slides are never moved with transforms.
- No Markup/Styles: Bring your own HTML and CSS.
- Attribute Driven: Set it up with `data-carousel--*` attributes, and style it with the state attributes the library writes.
- Markers: Dots, numbers or thumbnails, from a `<template>` or your own links.
- Infinite Looping: Loops without cloning slides, so there are no duplicate ids or form fields.
- Mouse Drag: Drag the track with a mouse. Touch already works natively.
- Accessible Autoplay: Pauses on hover and out of view, stops on focus, and respects reduced motion.
- Accessibility: Adds roles, labels, `aria-current`, a live status and optional `inert`.
- Right to Left and Vertical: Follows your CSS.
- Dynamic Markup: Slides added or removed are picked up automatically.
- Catalyst: An optional Catalyst store, imported separately.

## Getting Started

### Installation

```bash
npm install @lucidclient/carousel
```

### Usage

```typescript
import carousel from "@lucidclient/carousel";

carousel.init();
```

```html
<section data-carousel aria-label="Featured products">
  <ul data-carousel--track class="carousel-track">
    <li id="product-1">…</li>
    <li id="product-2">…</li>
    <li id="product-3">…</li>
  </ul>

  <button data-carousel--action="prev" aria-label="Previous products">‹</button>
  <button data-carousel--action="next" aria-label="Next products">›</button>

  <div data-carousel--markers>
    <template><button class="carousel-dot"></button></template>
  </div>

  <p data-carousel--status class="visually-hidden"></p>
</section>
```

Give every carousel an `aria-label` or `aria-labelledby` that describes its content. Leave out the word "carousel", as screen readers already announce it as one.

### CSS

The library ships no CSS. This is the minimum you need:

```css
.carousel-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
}

.carousel-track > * {
  flex: 0 0 100%;
  scroll-snap-align: start;
}

/* Hide the controls until JavaScript is ready. They keep their space, so nothing jumps. */
[data-carousel]:not([data-carousel--ready])
  :is([data-carousel--action], [data-carousel--markers]) {
  visibility: hidden;
}

/* Hide the scrollbar once the controls work. Without JavaScript, mouse users need it. */
[data-carousel--ready] .carousel-track {
  scrollbar-width: none;
}

[aria-disabled="true"] {
  opacity: 0.4;
}
```

- Size slides with `flex-basis`. For three in view with a `1rem` gap, use `calc((100% - 2rem) / 3)`.
- `scroll-snap-align` can be `start`, `center` or `end`. `scroll-padding` and `scroll-margin` are respected.
- Add `scroll-behavior: smooth` to the track for smooth buttons and markers. Wrap it in `prefers-reduced-motion: no-preference`.
- Use `scroll-snap-type: y mandatory` and a fixed height for a vertical carousel.

## Markup

### Elements

| Attribute | Description |
| --- | --- |
| `data-carousel` | The carousel. |
| `data-carousel--track` | The element that scrolls. Its children are the slides. |
| `data-carousel--action` | A button: `prev`, `next`, `toggle`, `play` or `pause`. |
| `data-carousel--markers` | A container. Its `<template>` is cloned once per page. |
| `data-carousel--marker` | A marker you write yourself. See [Markers](#markers). |
| `data-carousel--status` | A live region that announces the page, such as "Slide 2 of 5", when a visitor moves the carousel. |

Controls and markers work on the carousel they sit inside. To put one elsewhere on the page, point its `aria-controls` at the id of the carousel or its track.

The library fills in the accessibility the markup leaves out. Anything you set yourself is kept:

- The carousel gets `role="region"` and `aria-roledescription="carousel"`.
- `div`, `span` and custom element slides get `role="group"`, `aria-roledescription="slide"` and a label such as "2 of 5". List items, links and other elements keep their own meaning.
- Buttons get `type="button"`, and the status gets `aria-live="polite"`.

### Options

Add these to the `data-carousel` element.

| Attribute | Description |
| --- | --- |
| `data-carousel--loop` | Loops forever. See [Looping](#looping). |
| `data-carousel--rewind` | `next` on the last page goes back to the first, and `prev` on the first goes to the last. |
| `data-carousel--drag` | Lets a mouse drag the track. |
| `data-carousel--autoplay` | Moves on every 5 seconds. Set a value in milliseconds to change it, such as `"3000"`. |
| `data-carousel--inert` | Makes slides out of view `inert`. See [Inert slides](#inert-slides). |

Set any option to `"false"` to turn it off.

### State

The library writes the carousel's state to the markup, so you can style it.

| On | Attribute | Description |
| --- | --- | --- |
| Carousel | `data-carousel--ready` | The carousel is set up. |
| Carousel | `data-carousel--index` | The current page, from 0. Also `--carousel-index` in CSS. |
| Carousel | `data-carousel--count` | The number of pages. Also `--carousel-count` in CSS. |
| Carousel | `data-carousel--at-start`, `data-carousel--at-end` | At the first or last page. Never set while looping. |
| Carousel | `data-carousel--scrollable` | The slides overflow, so there's somewhere to scroll. |
| Carousel | `data-carousel--playing` | Autoplay is on, even while paused on hover. |
| Carousel | `data-carousel--dragging` | A mouse drag is happening. |
| Slide | `data-carousel--active` | On the current page. |
| Slide | `data-carousel--visible` | At least half in view. |
| Control | `aria-disabled="true"` | `prev` or `next` at an end. They stay focusable. |
| Marker | `aria-current="true"` | Marks the current page. |

The CSS variables update once scrolling stops. The attributes update as it scrolls.

## How It Works

### Pages

A page is a position the track can snap to. With one slide in view, every slide is a page. With several in view, the last few slides share the final page, as the track can't scroll any further. For example, ten slides with three in view make eight pages.

### Markers

A `<template>` inside `data-carousel--markers` is copied once per page. `{n}` and `{count}` become the page number and the number of pages:

```html
<div data-carousel--markers>
  <template>
    <button aria-label="Show page {n} of {count}"></button>
  </template>
</div>
```

Markers without a label get one, such as "Go to slide 2".

You can also write your own markers. Each scrolls to the slide numbered in its value (from 0), the slide its link points to, or else the slide matching its position among the markers:

```html
<a href="#photo-1" data-carousel--marker>1</a>
<a href="#photo-2" data-carousel--marker>2</a>
<button data-carousel--marker="4">Last photo</button>
```

Links like these still work without JavaScript. With it, they scroll the track without jumping the page or changing the URL.

### Looping

`data-carousel--loop` reorders slides with CSS `order` instead of cloning them. The DOM order never changes, so screen readers and the tab order still follow your markup.

- The track must be a flex or grid container with 3 or more slides, and room to scroll at least one slide. Otherwise it rewinds instead and logs a warning.
- `prev` and `next` are never disabled, and markers take the shortest way round.

### Mouse Drag

`data-carousel--drag` lets a mouse drag the track. On release it settles on the nearest page, or moves on one after a quick flick. Clicks on links and buttons inside slides still work, and form fields are left alone.

These styles show the drag cursor:

```css
[data-carousel--drag][data-carousel--scrollable] .carousel-track {
  cursor: grab;
}
[data-carousel--dragging] .carousel-track {
  cursor: grabbing;
}
```

### Autoplay

`data-carousel--autoplay` follows the [WAI-ARIA carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/):

- It pauses while the mouse is over the carousel, while it's out of view and while the tab is hidden.
- It stops when keyboard focus moves into the carousel, or when a visitor moves it.
- It doesn't start for visitors who prefer reduced motion. They can still start it with a `toggle` or `play` button.

Always include a `toggle` or `pause` button, as WCAG requires a way to stop moving content. Put it first in the carousel, so keyboard users reach it before the slides. A toggle without text gets a label that matches its state: "Stop automatic slide show" or "Start automatic slide show".

### Inert Slides

`data-carousel--inert` makes slides out of view `inert`, so keyboard and screen reader users only reach the slide on screen. Use it when one slide fills the view. Carousels with several slides in view are easier to browse without it.

## API

```typescript
import carousel, { type CarouselChange } from "@lucidclient/carousel";

carousel.init();

const gallery = carousel.get("gallery");
gallery?.next();
gallery?.goTo(2);
gallery?.subscribe((state) => console.log(state.index));

document.addEventListener("carousel-change", (event) => {
  const { index, previousIndex, count } = (event as CustomEvent<CarouselChange>)
    .detail;
});
```

### Methods

| Method | Description |
| --- | --- |
| `init(options?)` | Sets up every `data-carousel` element. Calling it again starts over. |
| `refresh()` | Picks up new carousels, controls, markers and option changes, and removes carousels that left the page. |
| `destroy()` | Removes every carousel's listeners, and every attribute and style the library added. |
| `get(target)` | Returns the carousel for an element inside it, or for the id of the carousel or its track. |

`get` returns a `Carousel`:

| Member | Description |
| --- | --- |
| `element`, `track` | The carousel and track elements. |
| `state` | `{ index, count, atStart, atEnd, scrollable, playing }`. |
| `next()`, `prev()`, `goTo(index)` | Scroll to a page. These stop autoplay. |
| `play()`, `pause()`, `toggle()` | Start or stop autoplay. Works without `data-carousel--autoplay` too. |
| `subscribe(listener)` | Runs the listener after every state change. Returns a function that removes it. |
| `refresh()` | Re-reads this carousel's markup. |
| `destroy()` | Destroys this carousel. |

Slides added or removed are picked up automatically. For anything else that changes after `init`, call `refresh()`.

### Events

`carousel-change` fires on the `data-carousel` element whenever the page changes, with `{ index, previousIndex, count }` as its `detail`. It bubbles, and doesn't fire on load.

### Labels

Translate or reword the text the library writes for screen readers:

```typescript
carousel.init({
  labels: {
    slide: "{n} sur {count}",
    marker: "Aller à la diapositive {n}",
    status: "Diapositive {n} sur {count}",
    play: "Démarrer le diaporama",
    pause: "Arrêter le diaporama",
  },
});
```

| Label | Default | Used for |
| --- | --- | --- |
| `slide` | `{n} of {count}` | Slides without a label. |
| `marker` | `Go to slide {n}` | Template markers without a label. |
| `status` | `Slide {n} of {count}` | The status announcement. |
| `play`, `pause` | `Start automatic slide show`, `Stop automatic slide show` | Autoplay buttons without text. |

## Catalyst

`@lucidclient/carousel/catalyst` exports `carouselStore`, a [Catalyst](https://github.com/ProtoDigitalUK/lucid_client/tree/master/packages/catalyst) store that follows a carousel. Use it to read and control the carousel from any markup inside the store. It needs `@lucidclient/catalyst` 0.6 or later.

```typescript
import Catalyst from "@lucidclient/catalyst";
import { bind, dom, events, loop } from "@lucidclient/catalyst/reactions";
import carousel from "@lucidclient/carousel";
import { carouselStore } from "@lucidclient/carousel/catalyst";

carousel.init();

Catalyst.start({
  stores: { gallery: carouselStore },
  reactions: [bind, dom, events, loop],
});
```

```html
<div data-store="gallery">
  <section data-carousel data-ref="#carousel" aria-label="Destinations">
    <div data-carousel--track class="carousel-track">…</div>
  </section>

  <button data-events--click="@prev" data-bind--disabled="$atStart">Previous</button>
  <span data-dom--text="$indexOne"></span> / <span data-dom--text="$count"></span>
  <button data-events--click="@next" data-bind--disabled="$atEnd">Next</button>

  <ol data-loop="$pages">
    <template>
      <li>
        <button
          data-events--click="@goTo"
          data-bind--aria-current="@isCurrent"
          data-dom--text="$indexOne"
        ></button>
      </li>
    </template>
  </ol>
</div>
```

| Reference | Description |
| --- | --- |
| `$index`, `$indexOne` | The current page, from 0 and from 1. |
| `$count`, `$atStart`, `$atEnd`, `$scrollable`, `$playing` | The carousel's state. |
| `$pages` | The page indexes, `[0, 1, 2, …]`, for `data-loop`. |
| `@next`, `@prev`, `@play`, `@pause`, `@toggle` | Call the matching methods. |
| `@goTo` | Scrolls to a page: a number, or the current loop item. |
| `@isCurrent` | Whether the current loop item is the current page. |

- Put `data-ref="#carousel"` on the `data-carousel` element.
- `carousel.init()` can run before or after `Catalyst.start()`.
- If you add the ref later, call `Catalyst.sync()` and then `carousel.refresh()`.
- Each store scope follows its own carousel.

## Browser Support

Works in every browser that supports CSS scroll snapping. Uses `scrollend` where available, with a fallback for browsers without it.
