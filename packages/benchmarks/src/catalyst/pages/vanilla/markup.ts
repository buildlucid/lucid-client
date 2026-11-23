import { defineHarness } from "../../../harness.ts";
import { buildCards, INSERT_COUNT } from "../../data.ts";
import { cardMarkup, setUpCard } from "./card.ts";

const html = buildCards(INSERT_COUNT).map(cardMarkup).join("");
const app = document.querySelector("#app")!;

defineHarness({
	insert: () => {
		app.innerHTML = html;
		for (const card of app.querySelectorAll("article")) setUpCard(card);
	},
	clear: () => {
		app.innerHTML = "";
	},
});
