/**
 * `true` in the development build and `false` in the production build, which
 * leaves out the code inside `if (__DEV__)`, such as warnings. Bundlers pick
 * the development build through the `development` export condition.
 */
declare const __DEV__: boolean;

interface Navigator {
	/**
	 * The parts of the Network Information API the library reads. Only
	 * Chromium browsers have it.
	 */
	readonly connection?: {
		readonly saveData?: boolean;
		readonly effectiveType?: string;
	};
}
