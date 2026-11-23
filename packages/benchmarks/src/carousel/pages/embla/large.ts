import { defineHarness } from "../../../harness.ts";
import { LARGE_SLIDES, renderCarousels } from "../../data.ts";
import { carouselMarkup, start } from "./carousel.ts";

defineHarness({
	render: () => renderCarousels(carouselMarkup, 1, LARGE_SLIDES, false),
	start,
});
