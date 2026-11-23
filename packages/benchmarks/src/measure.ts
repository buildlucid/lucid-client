import type { Page } from "playwright";
import type { Session } from "./browser.ts";
import type { Step } from "./suite.ts";
import "./harness.ts";

/** A step that runs in the page, rather than in the runner. */
type PageStep = Exclude<Step, { wait: number } | { resize: unknown }>;

type StepOptions = { step: PageStep; timed: boolean; settle: boolean };

/**
 * Runs in the page, so it can't use anything from this module. Performs the
 * step, waits for the library to finish, and forces style and layout.
 *
 * Every library here batches its updates in microtasks, so a message posted
 * after the step arrives once all of them have run. The time covers the event,
 * the library's work and the browser's style and layout, but not painting:
 * every library renders the same DOM, so painting it costs the same.
 *
 * Without `settle`, it only triggers the step and returns, for `work`, which
 * measures what follows from the runner. The browser only counts script that
 * runs in the page's own tasks, not script `page.evaluate` runs, so the step
 * runs in a task of its own, as a click or a timer would. Otherwise a `call`
 * step, such as starting a library, would only count the work it leaves for
 * later frames and observers.
 */
const runStep = async ({ step, timed, settle }: StepOptions) => {
	const find = <T extends Element>(selector: string) => {
		const element = document.querySelector<T>(selector);
		if (!element) throw new Error(`Nothing matches "${selector}"`);
		return element;
	};

	// Everything the step needs is looked up before the clock starts.
	let trigger: () => void;
	if ("click" in step) {
		const element = find<HTMLElement>(step.click);
		trigger = () => element.click();
	} else if ("call" in step) {
		const call = window.harness?.[step.call] as
			| ((...args: unknown[]) => void)
			| undefined;
		if (!call) throw new Error(`The page has no "${step.call}" function`);
		const args = step.args ?? [];
		trigger = () => call(...args);
	} else {
		const field = find<HTMLInputElement>(step.input);
		const { value } = step;
		trigger = () => {
			field.value = value;
			field.dispatchEvent(new Event("input", { bubbles: true }));
		};
	}
	if (!settle) {
		setTimeout(trigger, 0);
		return 0;
	}

	const channel = new MessageChannel();
	const settled = new Promise<void>((resolve) => {
		channel.port1.onmessage = () => resolve();
	});

	if (timed) (globalThis as { gc?: () => void }).gc?.();

	const start = performance.now();
	trigger();
	channel.port2.postMessage(null);
	await settled;
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
	if ("wait" in step) {
		await page.waitForTimeout(step.wait);
		return;
	}
	if ("resize" in step) {
		await page.setViewportSize(step.resize);
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);
		return;
	}
	await page.evaluate(runStep, { step, timed: false, settle: true });
};

/**
 * Performs the timed step after collecting garbage, and returns its time in ms.
 * Garbage is collected once beforehand as well, so the collection just before
 * the step has almost nothing left to free and leaves no clean-up for the step.
 */
export const time = async (page: Page, step: Step) => {
	if ("wait" in step || "resize" in step)
		throw new Error("Only `work` can measure a wait or a resize");
	await page.evaluate(() => (globalThis as { gc?: () => void }).gc?.());
	return page.evaluate(runStep, { step, timed: true, settle: true });
};

/**
 * Performs the timed step and returns, in ms, the scripting, style and layout
 * work the page did from the step until `settleMs` later, in every task,
 * frame, event and observer that followed. The page is left to go quiet and
 * garbage is collected first, so earlier work isn't counted.
 */
export const work = async (session: Session, step: Step, settleMs: number) => {
	const { page } = session;
	await page.waitForTimeout(250);
	await page.evaluate(() => (globalThis as { gc?: () => void }).gc?.());
	const before = await session.busy();
	if ("resize" in step) await page.setViewportSize(step.resize);
	else if ("wait" in step) await page.waitForTimeout(step.wait);
	else await page.evaluate(runStep, { step, timed: true, settle: false });
	await page.waitForTimeout(settleMs);
	return (await session.busy()) - before;
};
