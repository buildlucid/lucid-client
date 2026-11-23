import { parseReference } from "../helpers.js";
import type { Directive, SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import { warn } from "./log.js";
import resolveDirectiveReference from "./resolve-directive-reference.js";

/** First-party reactions, whose names match their attributes. */
const FIRST_PARTY_REACTIONS = [
	"bind",
	"css",
	"dom",
	"events",
	"loop",
	"model",
	"trap",
];

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

/**
 * Whether an element belongs to a `data-store` element that was skipped
 * because another element already uses its scope. Results are cached per
 * sync, since siblings share their ancestors.
 */
const createDuplicateCheck = () => {
	const storeAttribute = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.store}`;
	const cache = new Map<Element, boolean>();
	const isInDuplicate = (element: Element): boolean => {
		const cached = cache.get(element);
		if (cached !== undefined) return cached;
		let result = false;
		const key = element.getAttribute(storeAttribute);
		if (key !== null) {
			const store = key ? Catalyst.stores.get(key) : undefined;
			result = store !== undefined && store.element !== element;
		} else if (element.parentElement) {
			result = isInDuplicate(element.parentElement);
		}
		cache.set(element, result);
		return result;
	};
	return isInDuplicate;
};

const collectDirectives = (target: Element, options?: SyncOptions) => {
	const directives: Directive[] = [];
	const separator = Catalyst.options.attributes.specifierSeparator;
	const prefix = Catalyst.options.attributes.prefix;
	const isInDuplicate = createDuplicateCheck();

	for (const element of collectElements(target, options)) {
		// Directives inside a skipped duplicate store are left unbound.
		if (isInDuplicate(element)) continue;
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
