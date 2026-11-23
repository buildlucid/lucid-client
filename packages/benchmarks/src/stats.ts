export type Measurement = {
	medianMs: number;
	meanMs: number;
	p95Ms: number;
	minMs: number;
	samples: number;
};

/** The value at `fraction` of the way through sorted samples. */
const percentile = (sorted: number[], fraction: number) => {
	const index = (sorted.length - 1) * fraction;
	const lower = sorted[Math.floor(index)] ?? 0;
	const upper = sorted[Math.ceil(index)] ?? lower;
	return lower + (upper - lower) * (index - Math.floor(index));
};

export const median = (values: number[]) =>
	percentile(
		[...values].sort((a, b) => a - b),
		0.5,
	);

export const summarise = (samples: number[]): Measurement => {
	const sorted = [...samples].sort((a, b) => a - b);
	return {
		medianMs: percentile(sorted, 0.5),
		meanMs: sorted.reduce((total, value) => total + value, 0) / sorted.length,
		p95Ms: percentile(sorted, 0.95),
		minMs: sorted[0] ?? 0,
		samples: sorted.length,
	};
};

/** Averages ratios such as "times slower than the fastest" fairly. */
export const geometricMean = (values: number[]) =>
	Math.exp(
		values.reduce((total, value) => total + Math.log(value), 0) / values.length,
	);
