import { defineHarness } from "../../../harness.ts";
import { buildCards, CARD_COUNT } from "../../data.ts";
import { cardMarkup, setUpCard } from "./card.ts";

const cards = buildCards(CARD_COUNT);
const app = document.querySelector("#app")!;

defineHarness({
	render: () => {
		app.innerHTML = cards.map(cardMarkup).join("");
	},
	start: () => {
		for (const card of app.querySelectorAll("article")) setUpCard(card);
	},
});
