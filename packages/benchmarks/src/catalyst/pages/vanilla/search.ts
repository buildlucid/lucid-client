import { buildRows, matchesQuery, ROW_COUNT } from "../../data.ts";

// Hand-written DOM code, as a baseline: one element per item, created once and
// reused whenever the item matches again.

const items = buildRows(ROW_COUNT).map((item) => {
	const element = document.createElement("li");
	element.textContent = item.label;
	return { item, element };
});
const list = document.querySelector("ul")!;
const count = document.querySelector("p span")!;
const field = document.querySelector("input")!;

const render = () => {
	const matches = items.filter(({ item }) => matchesQuery(item, field.value));
	list.replaceChildren(...matches.map(({ element }) => element));
	count.textContent = String(matches.length);
};

field.addEventListener("input", render);
render();
