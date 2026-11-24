import type { Reaction } from "../types/index.js";
import Catalyst from "./catalyst.js";
import { warn } from "./log.js";

/**
 * Attributes other Lucid Client packages own, such as Cookie Controller's
 * `data-cookie--*`, so a reaction can't claim their markup.
 */
const RESERVED_ATTRIBUTES = new Set([
	"carousel",
	"cookie",
	"form",
	"speculate",
]);

const registerReaction = (reaction: Reaction) => {
	if (Catalyst.initialised) {
		if (__DEV__)
			warn("Reactions must be registered before Catalyst.init() is called.");
		return;
	}
	if (Catalyst.reactions.has(reaction.name)) {
		if (__DEV__)
			warn(`A reaction named "${reaction.name}" is already registered.`);
		return;
	}
	if (RESERVED_ATTRIBUTES.has(reaction.attribute)) {
		if (__DEV__)
			warn(
				`The "${reaction.attribute}" attribute is reserved for another Lucid Client package.`,
			);
		return;
	}
	if (
		Array.from(Catalyst.reactions.values()).some(
			(existing) => existing.attribute === reaction.attribute,
		)
	) {
		if (__DEV__)
			warn(`A reaction already uses the "${reaction.attribute}" attribute.`);
		return;
	}

	Catalyst.reactions.set(reaction.name, reaction);
};

export default registerReaction;
