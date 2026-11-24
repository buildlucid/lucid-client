/**
 * `true` in the development build and `false` in the production build, which
 * leaves out the code inside `if (__DEV__)`, such as warnings. Bundlers pick
 * the development build through the `development` export condition.
 */
declare const __DEV__: boolean;
