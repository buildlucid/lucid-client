import type { Page } from "playwright";
import type { Session } from "./browser.ts";
import type { Step } from "./suite.ts";
import "./harness.ts";

/** A step that runs in the page, rather than in the runner. */
type PageStep = Exclude<
	Step,
	{ wait: number } | { settle: number } | { resize: unknown }
>;

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

/**
 * How long a page must do no scripting, style or layout work to count as
 * quiet, for steps that wait for a move to finish. Longer than the gaps
 * libraries leave while a transition or smooth scroll runs off the main
 * thread, and the delays they wait after scrolling before they settle.
 */
export const QUIET_MS = 300;

/**
 * How long a page must do no work before a timed step. Longer, as some
 * libraries still do work a while after the page loads or after their last
 * move, which would otherwise be counted against the step.
 */
export const QUIET_BEFORE_MS = 500;

/** How often the runner reads the page's work while it waits for it to go quiet. */
const POLL_MS = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits until the page has done no scripting, style or layout work for
 * `quiet` ms, once `min` ms have passed, or until `max` ms have passed,
 * whichever comes first. Only for waits that aren't timed: reading the work
 * while a library animates adds to it.
 */
export const settle = async (
	session: Session,
	{
		quiet = QUIET_MS,
		min = 0,
		max,
	}: { quiet?: number; min?: number; max: number },
) => {
	const start = performance.now();
	let last = await session.busy();
	let quietSince = start;
	for (;;) {
		await sleep(POLL_MS);
		const now = performance.now();
		const busy = await session.busy();
		if (busy !== last) {
			last = busy;
			quietSince = now;
		}
		if (now - start >= max) return;
		if (now - start >= min && now - quietSince >= quiet) return;
	}
};

/** Performs an untimed step. */
export const perform = async (session: Session, step: Step) => {
	const { page } = session;
	if ("wait" in step) {
		await page.waitForTimeout(step.wait);
		return;
	}
	if ("settle" in step) {
		await settle(session, { max: step.settle });
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
	if ("wait" in step || "settle" in step || "resize" in step)
		throw new Error("Only `work` can measure a wait or a resize");
	await page.evaluate(() => (globalThis as { gc?: () => void }).gc?.());
	return page.evaluate(runStep, { step, timed: true, settle: true });
};

/**
 * Performs the timed step and returns, in ms, the scripting, style and layout
 * work the page did from the step until `settleMs` later, in every task,
 * frame, event and observer that followed. The page is left to go quiet for
 * `QUIET_BEFORE_MS` and garbage is collected first, so earlier work isn't
 * counted. The page isn't read until the window ends, as reading its work
 * while a library animates adds to it.
 */
export const work = async (session: Session, step: Step, settleMs: number) => {
	const { page } = session;
	await settle(session, { quiet: QUIET_BEFORE_MS, max: 3000 });
	await page.evaluate(() => (globalThis as { gc?: () => void }).gc?.());
	const before = await session.busy();
	if ("resize" in step) await page.setViewportSize(step.resize);
	else if ("wait" in step) await page.waitForTimeout(step.wait);
	else if ("settle" in step) throw new Error("A settle step can't be timed");
	else await page.evaluate(runStep, { step, timed: true, settle: false });
	await page.waitForTimeout(settleMs);
	return (await session.busy()) - before;
};
