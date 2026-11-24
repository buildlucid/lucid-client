# @lucidclient/carousel

## v0.1.0 (unreleased)

### Features:

- Added Carousel, a bring your own markup and styles carousel built on CSS scroll snapping. `data-carousel` and `data-carousel--track` mark the carousel and the element that scrolls, and `init`, `refresh`, `destroy` and `get` manage carousels on the page.
- Pages follow the positions the track can snap to, from the slides' `scroll-snap-align` and the track's `scroll-padding`, so several slides in view share the pages they can't reach on their own.
- Added `data-carousel--action` controls for `prev`, `next`, `toggle`, `play` and `pause`, markers cloned from a `<template>` in `data-carousel--markers`, and `data-carousel--marker` for markers you write, including fragment links that work without JavaScript.
- Added `data-carousel--loop`, which loops by reordering slides with CSS `order` instead of cloning them, and `data-carousel--rewind`.
- Added `data-carousel--drag` for dragging the track with a mouse, with `drag` imported from `@lucidclient/carousel/drag` and passed to `init`, so carousels without it don't load it.
- Added `data-carousel--autoplay`, which follows the WAI-ARIA carousel pattern and holds while out of view, while the tab is hidden and for visitors who prefer reduced motion.
- Added carousel and slide semantics, `aria-disabled` controls, `aria-current` markers, a `data-carousel--status` live region, and `data-carousel--inert` for slides out of view.
- Added the `carousel-change` event, `subscribe`, and state attributes and CSS variables for styling.
- Added `messages` for translating the text the library writes, including the carousel and slide role descriptions, and `data-carousel--message-{name}` for one carousel's own, with plural forms picked by the carousel's language.
- Icon-only `prev` and `next` controls and markers without a name get a label, and `div` markers containers become a group named "Choose a slide".
- Warnings only log in the development build, which bundlers pick through the `development` export condition.
