# Carousel

> Part of the Lucid Client suite - documentation coming soon

A carousel for your own markup and styles, built on CSS scroll snapping. The track swipes and snaps without JavaScript, and the library adds buttons, markers, looping, autoplay and accessibility.

## Features

- Scroll Snap First: Swiping and snapping are the browser's own.
- Attribute Driven: Set up carousels with `data-carousel--*` attributes, and style them however you like.
- Markers: Dots, numbers or thumbnails.
- Looping: Loop from the last slide back to the first.
- Autoplay: Pauses on hover, stops on focus and respects reduced motion.
- Mouse Drag: Drag the track with a mouse.
- Accessible: Roles, labels and announcements as slides change.
- Translatable: Change any message the library writes.

## Installation

```bash
npm install @lucidclient/carousel
```

## Usage

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

```css
.carousel-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.carousel-track > * {
  flex: 0 0 100%;
  scroll-snap-align: start;
}

/* Hide the controls until the carousel is ready */
[data-carousel]:not([data-carousel--ready])
  :is([data-carousel--action], [data-carousel--markers]) {
  visibility: hidden;
}

[aria-disabled="true"] {
  opacity: 0.4;
}
```
