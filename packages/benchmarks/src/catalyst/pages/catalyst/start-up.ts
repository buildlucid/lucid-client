import Catalyst from "@lucidclient/catalyst";
import { bind, dom, events } from "@lucidclient/catalyst/reactions";
import { defineHarness } from "../../../harness.ts";
import { buildCards, CARD_COUNT } from "../../data.ts";
import { cardMarkup, cardStores } from "./card.ts";

const cards = buildCards(CARD_COUNT);
const stores = cardStores(cards);

defineHarness({
	render: () => {
		document.querySelector("#app")!.innerHTML = cards.map(cardMarkup).join("");
	},
	start: () => {
		Catalyst.start({ stores, reactions: [bind, dom, events] });
	},
});
