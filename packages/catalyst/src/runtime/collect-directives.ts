import { parseReference } from "../helpers.js";
import type { Directive, SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import { warn } from "./log.js";
import resolveDirectiveReference from "./resolve-directive-reference.js";

/** First-party reactions, whose names match their attributes. */
const FIRST_PARTY_REACTIONS = ["bind", "dom", "events", "loop", "trap"];

const matchesAttribute = (name: string, attribute: string) => {
	const base = `${Catalyst.options.attributes.prefix}${attribute}`;
	return (
		name === base ||
		name.startsWith(`${base}${Catalyst.options.attributes.specifierSeparator}`)
	);
};

/** In debug mode, reports markup for a first-party reaction that isn't registered. */
const reportUnregisteredReaction = (attributeName: string) => {
	for (const name of FIRST_PARTY_REACTIONS) {
		if (!matchesAttribute(attributeName, name)) continue;
		if (Catalyst.reactions.has(name) || Catalyst.reportedReactions.has(name)) {
			return;
		}
		Catalyst.reportedReactions.add(name);
		warn(
			`Found "${attributeName}" but the ${name} reaction isn't registered. Add ${name} to Catalyst.start({ reactions }).`,
		);
		return;
	}
};

const collectDirectives = (target: Element, options?: SyncOptions) => {
	const directives: Directive[] = [];
	const separator = Catalyst.options.attributes.specifierSeparator;
	const prefix = Catalyst.options.attributes.prefix;

	for (const element of collectElements(target, options)) {
		for (const attribute of element.attributes) {
			let matched = false;
			for (const reaction of Catalyst.reactions.values()) {
				const baseAttribute = `${prefix}${reaction.attribute}`;
				const specifierPrefix = `${baseAttribute}${separator}`;
				if (
					attribute.name !== baseAttribute &&
					!attribute.name.startsWith(specifierPrefix)
				) {
					continue;
				}

				const reference = parseReference(
					attribute.value,
					Catalyst.options.attributes.scopeSeparator,
				);
				directives.push({
					element,
					reaction: reaction.name,
					attributeName: attribute.name,
					specifier:
						attribute.name === baseAttribute
							? ""
							: attribute.name.slice(specifierPrefix.length),
					value: attribute.value,
					reference: resolveDirectiveReference(reference, element),
				});
				matched = true;
				break;
			}
			if (!matched && Catalyst.options.debug) {
				reportUnregisteredReaction(attribute.name);
			}
		}
	}

	return directives;
};

export default collectDirectives;
