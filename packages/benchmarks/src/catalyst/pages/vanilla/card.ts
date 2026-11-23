import type { Card } from "../../data.ts";

/** A card as the server renders it. */
export const cardMarkup = ({ id, likes }: Card) => `
	<article>
		<button class="toggle" aria-expanded="false">Card ${id}</button>
		<p hidden>Details for card ${id}</p>
		<button class="like"><span>${likes}</span> likes</button>
	</article>`;

/** Adds behaviour to a server-rendered card, reading its state from the markup. */
export const setUpCard = (card: Element) => {
	const toggle = card.querySelector(".toggle")!;
	const details = card.querySelector("p")!;
	const count = card.querySelector(".like span")!;
	let open = false;
	let likes = Number(count.textContent);

	toggle.addEventListener("click", () => {
		open = !open;
		toggle.setAttribute("aria-expanded", String(open));
		details.hidden = !open;
	});
	card.querySelector(".like")!.addEventListener("click", () => {
		likes += 1;
		count.textContent = String(likes);
	});
};
