# Carousel

> Part of the Lucid Client suite

A carousel for your own markup and styles, built on CSS scroll snapping. The track swipes and snaps without any JavaScript. The library adds the extras: buttons, markers, looping, mouse drag, autoplay and accessibility.

## Features

- Scroll Snap First: Scrolling and snapping are the browser's own. Slides are never moved with transforms.
- No Markup/Styles: Bring your own HTML and CSS.
- Attribute Driven: Set it up with `data-carousel--*` attributes, and style it with the state attributes the library writes.
- Markers: Dots, numbers or thumbnails, from a `<template>` or your own links.
- Infinite Looping: Loops without cloning slides, so there are no duplicate ids or form fields.
- Mouse Drag: Drag the track with a mouse, from its own import. Touch already works natively.
- Accessible Autoplay: Pauses on hover and out of view, stops on focus, and respects reduced motion.
- Accessibility: Adds roles, labels, `aria-current`, a live status and optional `inert`. See [Accessibility](#accessibility).
- Translatable: Every message the library writes can be set in `init` or with attributes, including plural forms. See [Messages](#messages).
- Right to Left and Vertical: Follows your CSS.
- Dynamic Markup: Slides added or removed are picked up automatically.
- Development Warnings: Markup mistakes are pointed out while you develop, and left out of production builds.

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
- Give every slide the same `scroll-snap-align`: `start`, `center` or `end`. The track's `scroll-padding` is respected.
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

The library fills in the accessibility the markup leaves out. See [Accessibility](#accessibility).

### Options

Add these to the `data-carousel` element.

| Attribute | Description |
| --- | --- |
| `data-carousel--loop` | Loops forever. See [Looping](#looping). |
| `data-carousel--rewind` | `next` on the last page goes back to the first, and `prev` on the first goes to the last. |
| `data-carousel--drag` | Lets a mouse drag the track. See [Mouse Drag](#mouse-drag). |
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

Markers without a name get one, such as "Go to slide 2".

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
- The slides look reordered, but the tab order doesn't change. With one slide in view, add `data-carousel--inert` so keyboard users only reach the slide on screen.

### Mouse Drag

`data-carousel--drag` lets a mouse drag the track. Dragging is its own import, so carousels without it don't load it. Pass it to `init`:

```typescript
import carousel from "@lucidclient/carousel";
import drag from "@lucidclient/carousel/drag";

carousel.init({ drag });
```

On release it settles on the nearest page, or moves on one after a quick flick. Clicks on links and buttons inside slides still work, and form fields are left alone.

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

## Accessibility

The library follows the [WAI-ARIA carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) and fills in what the markup leaves out. Anything you set yourself is kept, and `destroy` removes what the library added.

- The carousel gets `role="region"` and `aria-roledescription="carousel"`.
- `div`, `span` and custom element slides get `role="group"`, `aria-roledescription="slide"` and a label such as "2 of 5". List items, links and other elements keep their own meaning.
- Icon-only `prev` and `next` buttons get a label such as "Previous slide", and markers without a name get one such as "Go to slide 2". Text, an image's `alt`, `aria-label`, `aria-labelledby` and `title` all count as a name, apart from anything inside `aria-hidden="true"`.
- A `div` markers container becomes a group named "Choose a slide". Lists keep their own meaning.
- `prev` and `next` get `aria-disabled="true"` at the ends rather than `disabled`, so they keep focus. The current marker gets `aria-current="true"`.
- Buttons get `type="button"`, and the status gets `aria-live="polite"`. It announces the moves a visitor makes but not autoplay, so screen readers aren't interrupted every few seconds.

Your markup and CSS still need to:

- Name the carousel after its content with `aria-label` or `aria-labelledby`.
- Give an autoplaying carousel a visible `toggle` or `pause` button, first in the carousel.
- Make buttons and markers at least 24 by 24 pixels, or space them so a 24 pixel circle around each doesn't overlap another (WCAG 2.5.8).
- Show a focus style on every control and marker.
- Wrap `scroll-behavior: smooth` in `prefers-reduced-motion: no-preference`.

The [development build](#development-build) warns about a carousel without a name, an autoplaying carousel without a way to stop it, and a carousel that scrolls without controls or markers to move it.

## Messages

Translate or reword the text the library writes. `init` sets the messages for every carousel:

```typescript
carousel.init({
  messages: {
    carouselRole: "carrousel",
    slideRole: "diapositive",
    slide: "{n} sur {count}",
    marker: "Aller à la diapositive {n}",
    markers: "Choisir une diapositive",
    status: "Diapositive {n} sur {count}",
    prev: "Diapositive précédente",
    next: "Diapositive suivante",
    play: "Démarrer le diaporama",
    pause: "Arrêter le diaporama",
  },
});
```

A carousel can set its own with `data-carousel--message-{name}` attributes, with the names in kebab case. These win over `init`:

```html
<section
  data-carousel
  aria-label="Team photos"
  data-carousel--message-status="Photo {n} of {count}"
  data-carousel--message-slide-role="photo"
>
```

`{n}` and `{count}` are filled in. In `init`, a message can also be a function, such as `({ n, count }) => …`. For words that change with the number, an attribute can have plural forms, such as `data-carousel--message-slide-few`. The suffix is a plural category for the carousel's `lang` (`zero`, `one`, `two`, `few`, `many` or `other`) and is picked by `{count}`. The attribute without a suffix covers any form not given. Empty attributes are ignored.

| Message | Default | Used for |
| --- | --- | --- |
| `carouselRole` | `carousel` | The carousel's `aria-roledescription`. |
| `slideRole` | `slide` | The `aria-roledescription` of `div`, `span` and custom element slides. |
| `slide` | `{n} of {count}` | Slides without a label. |
| `marker` | `Go to slide {n}` | Markers without a name. |
| `markers` | `Choose a slide` | A `div` markers container's group. |
| `status` | `Slide {n} of {count}` | The status announcement. |
| `prev`, `next` | `Previous slide`, `Next slide` | `prev` and `next` buttons without a name. |
| `play`, `pause` | `Start automatic slide show`, `Stop automatic slide show` | Autoplay buttons without a name. |

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
| `init(options?)` | Sets up every `data-carousel` element. Calling it again starts over. Takes `messages` and `drag`. |
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

Slides added or removed are picked up automatically, and the slide in view stays in view. For anything else that changes after `init`, such as options, controls or markers, call `refresh()`.

### Events

`carousel-change` fires on the `data-carousel` element whenever the page changes, with `{ index, previousIndex, count }` as its `detail`. It bubbles, and doesn't fire on load.

### Development Build

The library warns about markup it can't work with, such as a carousel without a name, an autoplaying carousel without a stop control, a carousel that scrolls without controls or markers, or looping without room to loop. Warnings only log in the development build, which bundlers such as Vite and webpack pick through the `development` export condition while you develop. Production builds leave them out.

## Browser Support

Works in every browser that supports CSS scroll snapping. Uses `scrollend` where available, with a fallback for browsers without it.
