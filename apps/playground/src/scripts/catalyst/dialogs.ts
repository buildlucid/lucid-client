import { defineStore } from "@lucidclient/catalyst";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("dialogs");

const confirm = defineStore({
	state: { open: false, deleted: 0 },
	actions: ({ setState }) => ({
		open: () =>
			setState((state) => {
				state.open = true;
			}),
		delete: () => {
			setState((state) => {
				state.deleted += 1;
			});
			log.success("Deleted the project");
		},
	}),
	effects: ({ state, effect }) => ({
		logOpen: effect(
			() => state.open,
			(open, { isInitial }) => {
				if (!isInitial) log.info(`confirm.open is ${open}`);
			},
		),
	}),
});

const tip = defineStore({
	state: { open: false },
	actions: ({ setState }) => ({
		open: () =>
			setState((state) => {
				state.open = true;
			}),
	}),
	effects: ({ state, effect }) => ({
		logOpen: effect(
			() => state.open,
			(open, { isInitial }) => {
				if (!isInitial) log.info(`tip.open is ${open}`);
			},
		),
	}),
});

type Question = { question: string; answer: string; open: boolean };

const faq = defineStore({
	state: {
		questions: [
			{
				question: "What does data-model do here?",
				answer:
					"It keeps the details element's open state in sync with $item.open.",
				open: true,
			},
			{
				question: "Does closing it write state?",
				answer: "Yes. The toggle event writes the new open state.",
				open: false,
			},
			{
				question: "Can a button open every question?",
				answer: "Expand all writes open = true to every item.",
				open: false,
			},
		] as Question[],
		exclusive: [
			{
				question: "Exclusive question one",
				answer: "Opening the other question closes this one.",
				open: false,
			},
			{
				question: "Exclusive question two",
				answer: "The browser closes the other details in the group.",
				open: false,
			},
		] as Question[],
	},
	computed: ({ state }) => ({
		summary: () =>
			[...state.questions, ...state.exclusive]
				.map((item) => `${item.open ? "open  " : "closed"}  ${item.question}`)
				.join("\n"),
	}),
	actions: ({ setState }) => ({
		expandAll: () =>
			setState((state) => {
				for (const item of state.questions) item.open = true;
			}),
		collapseAll: () =>
			setState((state) => {
				for (const item of state.questions) item.open = false;
			}),
	}),
});

const misconfiguredDialogs = defineStore({
	state: { open: false, shown: false },
	computed: ({ state }) => ({ isOpen: () => state.shown }),
	actions: ({ setState }) => ({
		open: () =>
			setState((state) => {
				state.shown = true;
			}),
		reset: () =>
			setState((state) => {
				state.shown = false;
			}),
	}),
});

startCatalyst({ stores: { confirm, tip, faq, misconfiguredDialogs } });
