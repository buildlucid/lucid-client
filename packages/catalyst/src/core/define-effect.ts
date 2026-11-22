import type { StoreEffect } from "../types/index.js";

/**
 * Declares a store effect with its computed value typed. Effects written
 * inline in a module's `setup` receive an untyped value, because TypeScript
 * cannot infer it through `setup`'s return type.
 */
const defineEffect = <T>(effect: StoreEffect<T>) => effect;

export default defineEffect;
