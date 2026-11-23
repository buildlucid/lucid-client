import Alpine from "alpinejs";
import type { Card } from "../../data.ts";

/** A card's behaviour. The server passes in its `likes`. */
Alpine.data("card", (likes: number) => ({
	open: false,
	likes,
	toggle() {
		this.open = !this.open;
	},
	like() {
		this.likes += 1;
	},
}));

/** A card as the server renders it. */
export const cardMarkup = ({ id, likes }: Card) => `
	<article x-data="card(${likes})">
		<button class="toggle" aria-expanded="false" @click="toggle" :aria-expanded="open">Card ${id}</button>
		<p hidden :hidden="!open">Details for card ${id}</p>
		<button class="like" @click="like"><span x-text="likes">${likes}</span> likes</button>
	</article>`;
