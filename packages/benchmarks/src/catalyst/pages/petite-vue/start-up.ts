import { createApp } from "petite-vue";
import { defineHarness } from "../../../harness.ts";
import { buildCards, CARD_COUNT } from "../../data.ts";
import { Card, cardMarkup } from "./card.ts";

const cards = buildCards(CARD_COUNT);

defineHarness({
	render: () => {
		document.querySelector("#app")!.innerHTML = cards.map(cardMarkup).join("");
	},
	start: () => {
		createApp({ Card }).mount("#app");
	},
});
