/**
 * Data every library's pages render. It is built in the browser by each page,
 * from the same seed, so every library renders the same rows and cards in the
 * same order.
 */

export type Row = { id: number; label: string };
export type Card = { id: number; likes: number };

/** Rows in the rows and search pages. */
export const ROW_COUNT = 1000;
/** Server-rendered cards on the start-up page. */
export const CARD_COUNT = 250;
/** Cards the dynamic markup page inserts. */
export const INSERT_COUNT = 100;

const adjectives = [
	"pretty",
	"large",
	"big",
	"small",
	"tall",
	"short",
	"long",
	"handsome",
	"plain",
	"quaint",
	"clean",
	"elegant",
	"easy",
	"angry",
	"crazy",
	"helpful",
	"mushy",
	"odd",
	"unsightly",
	"adorable",
	"important",
	"inexpensive",
	"cheap",
	"expensive",
	"fancy",
];
const colours = [
	"red",
	"yellow",
	"blue",
	"green",
	"pink",
	"brown",
	"purple",
	"white",
	"black",
	"orange",
];
const nouns = [
	"table",
	"chair",
	"house",
	"barbecue",
	"desk",
	"car",
	"pony",
	"cookie",
	"sandwich",
	"burger",
	"pizza",
	"mouse",
	"keyboard",
];

let seed = 1;
let nextId = 1;

/** A seeded generator, so labels are the same on every page load. */
const pick = (words: string[]) => {
	seed = (seed * 16807) % 2147483647;
	return words[seed % words.length];
};

/** Builds new rows. Ids carry on from the last call, as an app's would. */
export const buildRows = (count: number): Row[] =>
	Array.from({ length: count }, () => ({
		id: nextId++,
		label: `${pick(adjectives)} ${pick(colours)} ${pick(nouns)}`,
	}));

export const buildCards = (count: number): Card[] =>
	Array.from({ length: count }, (_, index) => ({
		id: index + 1,
		likes: (index * 7) % 13,
	}));

/** What the search page filters its rows by. */
export const matchesQuery = (row: Row, query: string) =>
	row.label.includes(query.trim());
