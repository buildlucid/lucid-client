import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { Speculator } from "../src/index.js";
import type { IntentResult } from "../src/types.js";

type Data = { page: number };
type Details = { page: string | null };
type Result = IntentResult<Data, Details>;

const ok = (page: number): Result => ({ data: { page }, error: undefined });
const failed = (page: string | null): Result => ({
	data: undefined,
	error: { message: "Failed", details: { page } },
});

/** A promise that the test resolves itself. */
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

const createTrigger = (page: string) => {
	const button = document.createElement("button");
	button.dataset.page = page;
	button.innerHTML = `<span>Page <strong>${page}</strong></span>`;
	document.body.append(button);
	return button;
};

const getCacheKey = (element: Element) => element.getAttribute("data-page");

let speculators: Speculator<Data, Details>[] = [];
const create = (
	config: ConstructorParameters<typeof Speculator<Data, Details>>[0],
) => {
	const speculator = new Speculator<Data, Details>(config);
	speculators.push(speculator);
	return speculator;
};

beforeEach(() => {
	speculators = [];
});

afterEach(() => {
	for (const speculator of speculators) speculator.destroy();
	vi.useRealTimers();
	document.body.innerHTML = "";
});

describe("Speculator triggers", () => {
	it("uses the trigger, not the inner element, for clicks on markup inside it", async () => {
		const trigger = createTrigger("2");
		const fetch = vi.fn(async (element: Element) =>
			ok(Number(element.getAttribute("data-page"))),
		);
		const onClick = vi.fn();
		create({ elements: trigger, fetch, getCacheKey, onClick });

		trigger
			.querySelector("strong")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await vi.waitFor(() => expect(onClick).toHaveBeenCalledOnce());

		expect(fetch).toHaveBeenCalledExactlyOnceWith(trigger);
		expect(onClick.mock.calls[0]?.[1]).toEqual(ok(2));
	});
});

describe("Speculator hover intent", () => {
	it("prefetches once the pointer has stayed for the default 200ms", async () => {
		vi.useFakeTimers();
		const trigger = createTrigger("3");
		const fetch = vi.fn(async () => ok(3));
		create({ elements: trigger, fetch, getCacheKey });

		trigger.dispatchEvent(new MouseEvent("mouseenter"));
		await vi.advanceTimersByTimeAsync(199);
		expect(fetch).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(fetch).toHaveBeenCalledExactlyOnceWith(trigger);
	});

	it("cancels the prefetch when the pointer leaves before the delay", async () => {
		vi.useFakeTimers();
		const trigger = createTrigger("4");
		const fetch = vi.fn(async () => ok(4));
		create({ elements: trigger, fetch, getCacheKey, hoverDelay: 100 });

		trigger.dispatchEvent(new MouseEvent("mouseenter"));
		await vi.advanceTimersByTimeAsync(60);
		trigger.dispatchEvent(new MouseEvent("mouseleave"));
		await vi.advanceTimersByTimeAsync(500);

		expect(fetch).not.toHaveBeenCalled();
	});

	it("moving to another trigger only prefetches the new one", async () => {
		vi.useFakeTimers();
		const first = createTrigger("5");
		const second = createTrigger("6");
		const fetch = vi.fn(async (element: Element) =>
			ok(Number(element.getAttribute("data-page"))),
		);
		create({ elements: [first, second], fetch, getCacheKey });

		first.dispatchEvent(new MouseEvent("mouseenter"));
		await vi.advanceTimersByTimeAsync(100);
		second.dispatchEvent(new MouseEvent("mouseenter"));
		await vi.advanceTimersByTimeAsync(200);

		expect(fetch).toHaveBeenCalledExactlyOnceWith(second);
	});
});

describe("Speculator cache", () => {
	it("keeps successful results until they go stale", async () => {
		const trigger = createTrigger("7");
		const fetch = vi.fn(async () => ok(7));
		const speculator = create({ elements: trigger, fetch, getCacheKey });

		await speculator.prefetch(trigger);
		await speculator.prefetch(trigger);

		expect(fetch).toHaveBeenCalledOnce();
	});

	it("shares an in-flight fetch, then drops it if it resolves with an error", async () => {
		const trigger = createTrigger("8");
		const pending = deferred<Result>();
		const fetch = vi
			.fn<(element: Element) => Promise<Result>>()
			.mockReturnValueOnce(pending.promise)
			.mockResolvedValue(ok(8));
		const speculator = create({ elements: trigger, fetch, getCacheKey });

		const first = speculator.prefetch(trigger);
		const second = speculator.prefetch(trigger);
		expect(fetch).toHaveBeenCalledOnce();

		pending.resolve(failed("8"));
		expect(await first).toEqual(failed("8"));
		expect(await second).toEqual(failed("8"));

		expect(await speculator.prefetch(trigger)).toEqual(ok(8));
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("drops the result when fetch throws", async () => {
		const trigger = createTrigger("9");
		const fetch = vi
			.fn<(element: Element) => Promise<Result>>()
			.mockRejectedValueOnce(new Error("Network down"))
			.mockResolvedValue(ok(9));
		const speculator = create({ elements: trigger, fetch, getCacheKey });

		const result = await speculator.prefetch(trigger);
		expect(result.error?.message).toBe("Network down");

		expect(await speculator.prefetch(trigger)).toEqual(ok(9));
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("only drops the entry the failed fetch created", async () => {
		const trigger = createTrigger("10");
		const failing = deferred<Result>();
		const fetch = vi
			.fn<(element: Element) => Promise<Result>>()
			.mockReturnValueOnce(failing.promise)
			.mockResolvedValue(ok(10));
		const speculator = create({ elements: trigger, fetch, getCacheKey });

		const first = speculator.prefetch(trigger);
		speculator.clearCache(trigger);
		expect(await speculator.prefetch(trigger)).toEqual(ok(10));

		failing.resolve(failed("10"));
		await first;

		await speculator.prefetch(trigger);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
