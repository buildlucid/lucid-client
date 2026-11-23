import type { Reaction } from "../types/index.js";
import Catalyst from "./catalyst.js";
import { warn } from "./log.js";

const registerReaction = (reaction: Reaction) => {
	if (Catalyst.started) {
		if (__DEV__)
			warn("Reactions must be registered before Catalyst.start() is called.");
		return;
	}
	if (Catalyst.reactions.has(reaction.name)) {
		if (__DEV__)
			warn(`A reaction named "${reaction.name}" is already registered.`);
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
