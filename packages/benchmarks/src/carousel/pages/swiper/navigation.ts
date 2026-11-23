import { defineHarness } from "../../../harness.ts";
import { renderCarousels, SLIDES } from "../../data.ts";
import { carouselMarkup, clickDot, start } from "./carousel.ts";

renderCarousels(carouselMarkup, 1, SLIDES, true);
start();

defineHarness({ dot: clickDot });
