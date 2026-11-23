import { afterEach, beforeEach, vi } from "vite-plus/test";
import carousel from "../src/index.js";

/** happy-dom has no layout, so every observed element is reported in view */
class InViewObserver {
	constructor(private callback: IntersectionObserverCallback) {}
	observe(target: Element) {
		queueMicrotask(() =>
			this.callback(
				[{ isIntersecting: true, target } as IntersectionObserverEntry],
				this as unknown as IntersectionObserver,
			),
		);
	}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return [];
	}
}

/** happy-dom never reports resizes, so tests report them with `resize()` from utils */
export const resizeObservers = new Set<() => void>();
class ManualResizeObserver {
	constructor(private callback: ResizeObserverCallback) {}
	observe() {
		resizeObservers.add(this.notify);
	}
	unobserve() {}
	disconnect() {
		resizeObservers.delete(this.notify);
	}
	private notify = () => this.callback([], this as unknown as ResizeObserver);
}

beforeEach(() => {
	vi.stubGlobal("IntersectionObserver", InViewObserver);
	vi.stubGlobal("ResizeObserver", ManualResizeObserver);
});

afterEach(() => {
	carousel.destroy();
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	resizeObservers.clear();
	vi.useRealTimers();
});
