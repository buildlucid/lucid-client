import type { Reaction, MemberReference } from "../../types/index.js";

type EventRegistration = {
	count: number;
	abortController: AbortController;
};

const eventRegistrations = new WeakMap<
	EventTarget,
	Map<string, EventRegistration>
>();

const GLOBAL_TARGETS = ["document", "body", "head", "window"];

/**
 * HTML lowercases attribute names, so the event name in the specifier is always
 * lowercase. Events with uppercase letters in their names cannot be targeted.
 */
const getEventTarget = (
	element: Element,
	specifier: string,
): { target: EventTarget; eventName: string } | null => {
	const parts = specifier.split(".");
	const [first, second] = parts;
	if (first && GLOBAL_TARGETS.includes(first)) {
		if (!second) return null;
		switch (first) {
			case "document":
				return { target: document, eventName: second };
			case "body":
				return { target: document.body, eventName: second };
			case "head":
				return { target: document.head, eventName: second };
			case "window":
				return { target: window, eventName: second };
		}
	}

	return first ? { target: element, eventName: first } : null;
};

const callAction = (
	reference: MemberReference,
	event: Event,
	resolve: (reference: MemberReference, args?: unknown[]) => unknown,
) => {
	try {
		const result = resolve(reference, [event]);
		void Promise.resolve(result).catch(console.error);
	} catch (error) {
		console.error(error);
	}
};

const eventsReaction: Reaction = {
	name: "events",
	attribute: "events",
	setup: (directive, context) => {
		const reference = directive.reference;
		if (!reference || reference.type !== "action") {
			context.warn(
				`The "${directive.attributeName}" directive requires an action.`,
			);
			return;
		}
		if (!reference.scope) {
			context.warn(
				`Cannot infer a store for the reference "${reference.raw}".`,
			);
			return;
		}

		const config = getEventTarget(directive.element, directive.specifier);
		if (!config) {
			context.warn(
				`The "${directive.attributeName}" directive requires an event specifier.`,
			);
			return;
		}

		let targetRegistrations = eventRegistrations.get(config.target);
		if (!targetRegistrations) {
			targetRegistrations = new Map();
			eventRegistrations.set(config.target, targetRegistrations);
		}
		const registrations = targetRegistrations;

		// Identical listeners on a shared target (document, window) run once.
		const registrationKey = `${config.eventName}:${reference.scope}:${reference.key}`;
		let registration = registrations.get(registrationKey);
		if (registration) {
			registration.count += 1;
		} else {
			const abortController = new AbortController();
			config.target.addEventListener(
				config.eventName,
				(event) => callAction(reference, event, context.resolve),
				{ signal: abortController.signal },
			);
			registration = { count: 1, abortController };
			registrations.set(registrationKey, registration);
		}

		const owned = registration;
		return () => {
			owned.count -= 1;
			if (owned.count > 0) return;
			owned.abortController.abort();
			if (registrations.get(registrationKey) === owned) {
				registrations.delete(registrationKey);
			}
		};
	},
};

export default eventsReaction;
