import { defineStore } from "@lucidclient/catalyst";
import type { Card } from "../../data.ts";

/** A card's behaviour. The server renders its `likes`, and `open` starts false. */
export const card = defineStore({
	state: { open: false, likes: 0 },
	computed: ({ state }) => ({
		closed: () => !state.open,
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((draft) => {
				draft.open = !draft.open;
			}),
		like: () =>
			setState((draft) => {
				draft.likes += 1;
			}),
	}),
});

/** Scope names must be unique, so the definition is registered once per card. */
export const cardStores = (cards: Card[]) =>
	Object.fromEntries(cards.map(({ id }) => [`card-${id}`, card]));

/** A card as the server renders it. */
export const cardMarkup = ({ id, likes }: Card) => `
	<article data-store="card-${id}" data-state--likes="${likes}">
		<button class="toggle" aria-expanded="false" data-events--click="@toggle" data-bind--aria-expanded="$open">Card ${id}</button>
		<p hidden data-bind--hidden="$closed">Details for card ${id}</p>
		<button class="like" data-events--click="@like"><span data-dom--text="$likes">${likes}</span> likes</button>
	</article>`;
