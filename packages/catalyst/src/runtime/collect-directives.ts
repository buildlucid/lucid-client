import { parseReference } from "../helpers.js";
import type {
	Directive,
	LoopContext,
	MemberReference,
	Reaction,
} from "../types/index.js";
import Catalyst from "./catalyst.js";
import { warn } from "./log.js";
import { getElementLoopContext } from "./loop-context.js";
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

/** Where an element sits: its nearest store and loop item. */
type ElementContext = {
	/** The scope of the nearest `data-store` element, if it can be used. */
	scope: string | null;
	/**
	 * Whether the nearest `data-store` element was skipped because another
	 * element already uses its scope. Directives inside it are left unbound.
	 */
	inDuplicate: boolean;
	loop: LoopContext | undefined;
};

const OUTSIDE: ElementContext = {
	scope: null,
	inDuplicate: false,
	loop: undefined,
};

/**
 * Finds each element's context from its parent's, so a sync looks at each
 * ancestor once rather than once per directive. Results are cached for one
 * sync, since stores and loop items change between syncs.
 */
const createContextLookup = () => {
	const storeAttribute = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.store}`;
	const cache = new Map<Element, ElementContext>();

	const fromParent = (element: Element, parent: ElementContext) => {
		const loop = getElementLoopContext(element) ?? parent.loop;
		const key = element.getAttribute(storeAttribute);
		if (key === null) {
			return loop === parent.loop ? parent : { ...parent, loop };
		}
		const store = key ? Catalyst.stores.get(key) : undefined;
		const inDuplicate = store !== undefined && store.element !== element;
		return { scope: key && !inDuplicate ? key : null, inDuplicate, loop };
	};

	return (element: Element): ElementContext => {
		const cached = cache.get(element);
		if (cached) return cached;
		// Ancestors not looked up yet, nearest first.
		const pending: Element[] = [];
		let current: Element | null = element;
		let context = OUTSIDE;
		while (current) {
			const known = cache.get(current);
			if (known) {
				context = known;
				break;
			}
			pending.push(current);
			current = current.parentElement;
		}
		for (let index = pending.length - 1; index >= 0; index -= 1) {
			const ancestor = pending[index] as Element;
			context = fromParent(ancestor, context);
			cache.set(ancestor, context);
		}
		return context;
	};
};

type AttributeMatch = { reaction: Reaction; specifier: string } | null;

/**
 * Attribute names already matched to a reaction, kept for the reactions map
 * `start` builds, since names such as `data-dom--text` repeat on every item.
 */
const matches = new WeakMap<
	Map<string, Reaction>,
	Map<string, AttributeMatch>
>();

/**
 * The reaction an attribute belongs to, and its specifier: `data-bind` and
 * `data-bind--href` both belong to the reaction with the `bind` attribute.
 */
const matchAttribute = (
	name: string,
	reactions: Map<string, Reaction>,
	separator: string,
): AttributeMatch => {
	let cache = matches.get(reactions);
	if (!cache) {
		cache = new Map();
		matches.set(reactions, cache);
	}
	const cached = cache.get(name);
	if (cached !== undefined) return cached;

	let match: AttributeMatch = null;
	const reaction = reactions.get(name);
	if (reaction) match = { reaction, specifier: "" };
	let index = reaction ? -1 : name.indexOf(separator);
	while (!match && index > 0) {
		const base = reactions.get(name.slice(0, index));
		if (base) {
			match = {
				reaction: base,
				specifier: name.slice(index + separator.length),
			};
		}
		index = name.indexOf(separator, index + 1);
	}
	if (cache.size >= 1000) cache.clear();
	cache.set(name, match);
	return match;
};

/** Parsed attribute values, for the scope separator they were parsed with. */
const parsed = new Map<string, MemberReference | null>();
let parsedSeparator = "";

/**
 * Parses an attribute value, reusing an earlier parse of the same value, since
 * loop items repeat the same few. The result is shared, so its path is frozen.
 */
const parseValue = (value: string, scopeSeparator: string) => {
	if (parsedSeparator !== scopeSeparator) {
		parsed.clear();
		parsedSeparator = scopeSeparator;
	}
	let reference = parsed.get(value);
	if (reference === undefined) {
		if (parsed.size >= 1000) parsed.clear();
		reference = parseReference(value, scopeSeparator);
		if (reference) Object.freeze(reference.path);
		parsed.set(value, reference);
	}
	return reference;
};

/** Reads the directives of `elements`, which a sync collects in document order. */
const collectDirectives = (elements: Element[]) => {
	const directives: Directive[] = [];
	const { prefix, specifierSeparator, scopeSeparator } =
		Catalyst.options.attributes;
	const reactions = Catalyst.reactionAttributes;
	const lookup = createContextLookup();

	for (const element of elements) {
		if (!element.hasAttributes()) continue;
		let context: ElementContext | undefined;
		// Attribute names are cheaper to read than `element.attributes`.
		for (const name of element.getAttributeNames()) {
			if (!name.startsWith(prefix)) continue;
			const match = matchAttribute(name, reactions, specifierSeparator);
			if (!match) {
				if (__DEV__ && Catalyst.options.debug) reportUnregisteredReaction(name);
				continue;
			}

			context ??= lookup(element);
			// Directives inside a skipped duplicate store are left unbound.
			if (context.inDuplicate) break;

			const value = element.getAttribute(name) ?? "";
			const parsedReference = parseValue(value, scopeSeparator);
			const reference = resolveDirectiveReference(
				parsedReference,
				context.loop,
				context.scope,
			);
			directives.push({
				element,
				reaction: match.reaction.name,
				attributeName: name,
				specifier: match.specifier,
				value,
				// Each directive gets its own reference, not the shared parse.
				reference:
					reference && reference === parsedReference
						? { ...reference }
						: reference,
			});
		}
	}

	return directives;
};

export default collectDirectives;
