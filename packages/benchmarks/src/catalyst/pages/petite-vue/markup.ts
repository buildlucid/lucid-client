import { createApp } from "petite-vue";
import { defineHarness } from "../../../harness.ts";
import { buildCards, INSERT_COUNT } from "../../data.ts";
import { Card, cardMarkup } from "./card.ts";

const html = buildCards(INSERT_COUNT).map(cardMarkup).join("");
const app = document.querySelector("#app")!;
let mounted: ReturnType<typeof createApp> | undefined;

// petite-vue only sets up markup it mounts, so new markup is mounted as its
// own app, and unmounted before it is removed.
defineHarness({
	insert: () => {
		app.innerHTML = html;
		mounted = createApp({ Card }).mount(app);
	},
	clear: () => {
		mounted?.unmount();
		app.innerHTML = "";
	},
});
