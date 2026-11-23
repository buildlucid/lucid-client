import type { Page } from "playwright";
import type { Step } from "./suite.ts";
import "./harness.ts";

type StepOptions = { step: Step; timed: boolean };

/**
 * Runs in the page, so it can't use anything from this module. Performs the
 * step, waits for the library to finish, and forces style and layout.
 *
 * Every library here batches its updates in microtasks, so a message posted
 * after the step arrives once all of them have run. The time covers the event,
 * the library's work and the browser's style and layout, but not painting:
 * every library renders the same DOM, so painting it costs the same.
 */
const runStep = async ({ step, timed }: StepOptions) => {
	const settle = () =>
		new Promise<void>((resolve) => {
			const channel = new MessageChannel();
			channel.port1.onmessage = () => resolve();
			channel.port2.postMessage(null);
		});
	const find = <T extends Element>(selector: string) => {
		const element = document.querySelector<T>(selector);
		if (!element) throw new Error(`Nothing matches "${selector}"`);
		return element;
	};

	if (timed) (globalThis as { gc?: () => void }).gc?.();

	const start = performance.now();
	if ("click" in step) {
		find<HTMLElement>(step.click).click();
	} else if ("call" in step) {
		const call = window.harness?.[step.call];
		if (!call) throw new Error(`The page has no "${step.call}" function`);
		call();
	} else {
		const field = find<HTMLInputElement>(step.input);
		field.value = step.value;
		field.dispatchEvent(new Event("input", { bubbles: true }));
	}
	await settle();
	void document.body.offsetHeight;
	const duration = performance.now() - start;

	// Untimed steps wait for the frame to paint, so their rendering can't spill
	// into the timed step.
	if (!timed) {
		await new Promise((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(resolve)),
		);
	}
	return duration;
};

/** Performs an untimed step. */
export const perform = async (page: Page, step: Step) => {
	await page.evaluate(runStep, { step, timed: false });
};

/** Performs the timed step after collecting garbage, and returns its time in ms. */
export const time = (page: Page, step: Step) =>
	page.evaluate(runStep, { step, timed: true });
