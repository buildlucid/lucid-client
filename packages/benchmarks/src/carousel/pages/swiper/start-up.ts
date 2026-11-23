import { defineHarness } from "../../../harness.ts";
import { CAROUSELS, renderCarousels, SLIDES } from "../../data.ts";
import { carouselMarkup, start } from "./carousel.ts";

defineHarness({
	render: () => renderCarousels(carouselMarkup, CAROUSELS, SLIDES, true),
	start,
});
