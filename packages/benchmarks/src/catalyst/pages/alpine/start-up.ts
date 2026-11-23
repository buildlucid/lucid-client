import Alpine from "alpinejs";
import { defineHarness } from "../../../harness.ts";
import { buildCards, CARD_COUNT } from "../../data.ts";
import { cardMarkup } from "./card.ts";

const cards = buildCards(CARD_COUNT);

defineHarness({
	render: () => {
		document.querySelector("#app")!.innerHTML = cards.map(cardMarkup).join("");
	},
	start: () => Alpine.start(),
});
