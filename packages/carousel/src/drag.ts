import { setUpDrag } from "./carousel/drag.js";
import type { Drag } from "./types.js";

/**
 * Mouse dragging for carousels with `data-carousel--drag`. Touch and pens
 * already scroll the track natively.
 *
 * ```ts
 * import carousel from "@lucidclient/carousel";
 * import drag from "@lucidclient/carousel/drag";
 *
 * carousel.init({ drag });
 * ```
 */
const drag = setUpDrag as unknown as Drag;

export default drag;
