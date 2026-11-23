import { buildRows, ROW_COUNT, type Row } from "../../data.ts";

// Hand-written DOM code, as a baseline: one cloned template per row and one
// click listener for the whole table.

const tbody = document.querySelector("tbody")!;
const template = document.createElement("template");
template.innerHTML =
	'<tr><td></td><td><button class="select"></button></td><td><button class="remove">Remove</button></td></tr>';
const prototype = template.content.firstElementChild!;

let rows: Row[] = [];
let elements: HTMLTableRowElement[] = [];
let selected: HTMLTableRowElement | null = null;

const labelOf = (element: HTMLTableRowElement) =>
	element.querySelector(".select")!;

const append = (added: Row[]) => {
	const fragment = document.createDocumentFragment();
	for (const row of added) {
		const element = prototype.cloneNode(true) as HTMLTableRowElement;
		element.firstElementChild!.textContent = String(row.id);
		labelOf(element).textContent = row.label;
		elements.push(element);
		fragment.append(element);
	}
	rows.push(...added);
	tbody.append(fragment);
};

const clear = () => {
	tbody.textContent = "";
	rows = [];
	elements = [];
	selected = null;
};

const actions: Record<string, () => void> = {
	run: () => {
		clear();
		append(buildRows(ROW_COUNT));
	},
	add: () => append(buildRows(ROW_COUNT)),
	update: () => {
		for (let index = 0; index < rows.length; index += 10) {
			const row = rows[index]!;
			row.label += " !!!";
			labelOf(elements[index]!).textContent = row.label;
		}
	},
	clear,
	swap: () => {
		const second = elements[1];
		const last = elements[998];
		if (!second || !last) return;
		const afterLast = last.nextSibling;
		tbody.insertBefore(last, second);
		tbody.insertBefore(second, afterLast);
		[rows[1], rows[998]] = [rows[998]!, rows[1]!];
		[elements[1], elements[998]] = [last, second];
	},
};

for (const [id, action] of Object.entries(actions)) {
	document.getElementById(id)!.addEventListener("click", action);
}

tbody.addEventListener("click", (event) => {
	const button = (event.target as Element).closest("button");
	const element = button?.closest("tr");
	if (!button || !element) return;
	if (button.classList.contains("select")) {
		selected?.classList.remove("danger");
		element.classList.add("danger");
		selected = element;
	} else {
		const index = elements.indexOf(element);
		if (selected === element) selected = null;
		element.remove();
		rows.splice(index, 1);
		elements.splice(index, 1);
	}
});
