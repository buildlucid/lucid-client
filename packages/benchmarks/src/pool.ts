/**
 * Runs tasks with at most `limit` running at once, and returns their results
 * in the order the tasks were given. For work that isn't timed, such as
 * checking every library's output, which spends most of its time waiting.
 */
export const pool = async <T>(
	tasks: Array<() => Promise<T>>,
	limit: number,
): Promise<T[]> => {
	const results: T[] = [];
	let next = 0;
	const worker = async () => {
		while (next < tasks.length) {
			const index = next++;
			const task = tasks[index];
			if (task) results[index] = await task();
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(limit, tasks.length) }, worker),
	);
	return results;
};
