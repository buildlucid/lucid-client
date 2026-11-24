import Catalyst from "@lucidclient/catalyst";
import { bind, dom, events } from "@lucidclient/catalyst/reactions";
import { defineHarness } from "../../../harness.ts";
import { buildCards, INSERT_COUNT } from "../../data.ts";
import { cardMarkup, cardStores } from "./card.ts";

const cards = buildCards(INSERT_COUNT);
const html = cards.map(cardMarkup).join("");
const app = document.querySelector("#app")!;

Catalyst.init({ stores: cardStores(cards), reactions: [bind, dom, events] });

defineHarness({
	insert: () => {
		app.innerHTML = html;
		Catalyst.sync(app);
	},
	clear: () => {
		app.innerHTML = "";
	},
});
