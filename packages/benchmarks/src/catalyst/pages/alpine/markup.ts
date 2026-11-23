import Alpine from "alpinejs";
import { defineHarness } from "../../../harness.ts";
import { buildCards, INSERT_COUNT } from "../../data.ts";
import { cardMarkup } from "./card.ts";

const html = buildCards(INSERT_COUNT).map(cardMarkup).join("");
const app = document.querySelector("#app")!;

Alpine.start();

// Alpine sets up markup added to the page by itself, and cleans up markup
// removed from it.
defineHarness({
	insert: () => {
		app.innerHTML = html;
	},
	clear: () => {
		app.innerHTML = "";
	},
});
