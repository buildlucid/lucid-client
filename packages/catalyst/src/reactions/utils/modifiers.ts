/** How long `debounce` and `throttle` wait without a duration. */
export const DEFAULT_WAIT = 250;

/** The modifiers in a specifier such as `lazy.trim`, in order. */
export const splitModifiers = (specifier: string) =>
	specifier ? specifier.split(".") : [];

/** A duration modifier such as `500ms` or `2s`, in milliseconds. */
export const parseDuration = (modifier: string | undefined) => {
	const match = modifier ? /^(\d+)(ms|s)$/.exec(modifier) : null;
	if (!match) return null;
	const amount = Number(match[1]);
	return match[2] === "s" ? amount * 1000 : amount;
};

/**
 * Calls `fn` once calls stop for `wait` milliseconds, with the last call's
 * argument. `cancel` drops a pending call and `flush` runs it now.
 */
export const debounce = <T>(fn: (value: T) => void, wait: number) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pending: { value: T } | null = null;
	const flush = () => {
		clearTimeout(timer);
		const next = pending;
		pending = null;
		if (next) fn(next.value);
	};
	return {
		call: (value: T) => {
			clearTimeout(timer);
			pending = { value };
			timer = setTimeout(flush, wait);
		},
		flush,
		cancel: () => {
			clearTimeout(timer);
			pending = null;
		},
	};
};
