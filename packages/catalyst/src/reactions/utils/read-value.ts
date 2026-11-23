import { stringifyState } from "../../helpers.js";

/** Serialises objects while tracking, so nested changes update the output. */
export const readSerialised = (value: unknown) =>
	typeof value === "object" && value !== null ? stringifyState(value) : value;

/** Copies arrays while tracking, so adding, removing or moving items updates. */
export const readItems = (value: unknown) =>
	Array.isArray(value) ? [...(value as unknown[])] : value;
