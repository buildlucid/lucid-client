import type { Card as CardData } from "../../data.ts";

/** A card's behaviour, used from `v-scope`. The server passes in its `likes`. */
export const Card = (likes: number) => ({
	open: false,
	likes,
	toggle() {
		this.open = !this.open;
	},
	like() {
		this.likes += 1;
	},
});

/** A card as the server renders it. */
export const cardMarkup = ({ id, likes }: CardData) => `
	<article v-scope="Card(${likes})">
		<button class="toggle" aria-expanded="false" @click="toggle" :aria-expanded="open">Card ${id}</button>
		<p hidden :hidden="!open">Details for card ${id}</p>
		<button class="like" @click="like"><span v-text="likes">${likes}</span> likes</button>
	</article>`;
