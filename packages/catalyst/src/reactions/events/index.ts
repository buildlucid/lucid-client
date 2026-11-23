import viewTransition from "../../core/view-transition.js";
import { NO_ROOT } from "../../runtime/reactive.js";
import type {
	Directive,
	Reaction,
	ReactionContext,
} from "../../types/index.js";
import callAction from "../utils/call-action.js";
import {
	DEFAULT_WAIT,
	debounce,
	parseDuration,
	splitModifiers,
} from "../utils/modifiers.js";

type EventRegistration = {
	count: number;
	listener: (event: Event) => void;
	cancel: () => void;
};

const eventRegistrations = new WeakMap<
	EventTarget,
	Map<string, EventRegistration>
>();

type Target = "element" | "document" | "body" | "head" | "window" | "outside";

const TARGETS = new Set<Target>([
	"document",
	"body",
	"head",
	"window",
	"outside",
]);

const FLAGS = [
	"prevent",
	"stop",
	"once",
	"self",
	"passive",
	"capture",
	"transition",
] as const;

type Flag = (typeof FLAGS)[number];

const SYSTEM_KEYS = ["shift", "ctrl", "alt", "meta"] as const;

type SystemKey = (typeof SYSTEM_KEYS)[number];

const KEYBOARD_EVENTS = new Set(["keydown", "keyup", "keypress"]);

type EventConfig = {
	target: Target;
	eventName: string;
	flags: Set<Flag>;
	systemKeys: SystemKey[];
	/** Key names, such as `escape`, one of which the event's key must match. */
	keys: string[];
	debounce: number | null;
	throttle: number | null;
	/** No modifiers, so the action is called directly. */
	plain: boolean;
};

/**
 * Reads `{target}.{event}.{modifiers}`. HTML lowercases attribute names, so
 * the event name is always lowercase, and events with uppercase letters in
 * their names cannot be listened to.
 */
const parse = (
	directive: Directive,
	context: ReactionContext,
): EventConfig | null => {
	const parts = splitModifiers(directive.specifier);
	const first = parts[0] as Target | undefined;
	const target = first && TARGETS.has(first) ? first : "element";
	if (target !== "element") parts.shift();
	const eventName = parts.shift();
	if (!eventName) return null;

	const config: EventConfig = {
		target,
		eventName,
		flags: new Set(),
		systemKeys: [],
		keys: [],
		debounce: null,
		throttle: null,
		plain: target !== "outside" && parts.length === 0,
	};
	const isKeyboard = KEYBOARD_EVENTS.has(eventName);
	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index] ?? "";
		if ((FLAGS as readonly string[]).includes(part)) {
			config.flags.add(part as Flag);
		} else if (part === "debounce" || part === "throttle") {
			// An optional duration follows, such as `debounce.500ms`.
			const duration = parseDuration(parts[index + 1]);
			if (duration !== null) index += 1;
			config[part] = duration ?? DEFAULT_WAIT;
		} else if ((SYSTEM_KEYS as readonly string[]).includes(part)) {
			config.systemKeys.push(part as SystemKey);
		} else if (isKeyboard) {
			config.keys.push(part);
		} else if (__DEV__) {
			context.warn(
				`The "${directive.attributeName}" directive has an unknown modifier "${part}". Key names, such as "escape", only apply to keydown and keyup.`,
			);
		}
	}
	return config;
};

/**
 * Parsed specifiers, since the same few, such as `click`, repeat on every
 * item of a loop. A misconfigured specifier warns the first time it is read.
 */
const configs = new Map<string, EventConfig | null>();

const parseSpecifier = (directive: Directive, context: ReactionContext) => {
	let config = configs.get(directive.specifier);
	if (config === undefined) {
		if (configs.size >= 1000) configs.clear();
		config = parse(directive, context);
		configs.set(directive.specifier, config);
	}
	return config;
};

/** A key as it is written in a modifier: `Escape` is `escape`, `ArrowDown` is `arrow-down`. */
const toKeyName = (key: string) =>
	key === " " ? "space" : key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

const matchesKeys = (event: Event, config: EventConfig) => {
	for (const key of config.systemKeys) {
		if (!(event as KeyboardEvent)[`${key}Key`]) return false;
	}
	if (config.keys.length === 0) return true;
	const key = (event as KeyboardEvent).key;
	return typeof key === "string" && config.keys.includes(toKeyName(key));
};

/** Whether the element is shown on the page, so it can be clicked outside of. */
const isShown = (element: Element) =>
	typeof element.checkVisibility === "function"
		? element.checkVisibility({ visibilityProperty: true })
		: element.getClientRects().length > 0 &&
			getComputedStyle(element).visibility !== "hidden";

const noop = () => {};

/**
 * The listener for one directive. Modifiers filter the event, then
 * `prevent` and `stop` apply straight away, even when the action is
 * debounced, throttled or run in a view transition, whose type is the
 * action's store scope. `isOutside` filters outside events.
 */
const createListener = (
	config: EventConfig,
	call: (event: Event) => void,
	scope: string,
	isOutside?: (event: Event) => boolean,
) => {
	if (config.plain) return { listener: call, cancel: noop };
	const { flags } = config;
	// A debounced call or a transition runs later, so it is dropped once the
	// directive is disposed, rather than calling a store that may be gone.
	let active = true;
	const callActive = (event: Event) => {
		if (active) call(event);
	};
	const run = flags.has("transition")
		? (event: Event) => {
				viewTransition(() => callActive(event), { types: [scope] });
			}
		: callActive;
	// `once` counts the call that runs, so a debounced burst still waits.
	const commit = (event: Event) => {
		if (flags.has("once")) done = true;
		run(event);
	};
	const debounced =
		config.debounce === null ? null : debounce(commit, config.debounce);
	let lastRun = Number.NEGATIVE_INFINITY;
	let done = false;

	const listener = (event: Event) => {
		if (done) return;
		if (flags.has("self") && event.target !== event.currentTarget) return;
		if (isOutside && !isOutside(event)) return;
		if (!matchesKeys(event, config)) return;
		if (flags.has("prevent")) event.preventDefault();
		if (flags.has("stop")) event.stopPropagation();
		if (config.throttle !== null) {
			const now = performance.now();
			if (now - lastRun < config.throttle) return;
			lastRun = now;
		}
		if (debounced) debounced.call(event);
		else commit(event);
	};
	return {
		listener,
		cancel: () => {
			active = false;
			debounced?.cancel();
		},
	};
};

/**
 * Listens for events outside the element, on `document`. Whether an event is
 * outside is decided as it starts, in the capture phase: the element must be
 * shown and the event's path must not include it. The action runs once the
 * event has bubbled, after the clicked element's own actions. Deciding first
 * matters because the page can change in between: a button that opens a
 * popup shows it before the event reaches `document`, and that click
 * mustn't close it again.
 */
const listenOutside = (
	element: Element,
	config: EventConfig,
	call: (event: Event) => void,
	scope: string,
	options: AddEventListenerOptions,
) => {
	const { eventName } = config;
	// Events that started outside the element. An event this listener didn't
	// see start, such as the click that rendered the element, isn't outside.
	const outside = new WeakSet<Event>();
	const { listener, cancel } = createListener(config, call, scope, (event) =>
		outside.has(event),
	);
	const onStart = (event: Event) => {
		// Decided again each time, in case the same event is dispatched again.
		outside.delete(event);
		if (isShown(element) && !event.composedPath().includes(element)) {
			outside.add(event);
		}
		// Events that don't bubble, such as `focus`, never return to
		// `document` unless they were dispatched on it.
		if (!event.bubbles && !options.capture && event.target !== document) {
			listener(event);
		}
	};
	document.addEventListener(eventName, onStart, true);
	document.addEventListener(eventName, listener, options);
	return () => {
		document.removeEventListener(eventName, onStart, true);
		document.removeEventListener(eventName, listener, options.capture);
		cancel();
	};
};

const getTarget = (element: Element, target: Target): EventTarget => {
	switch (target) {
		case "document":
		case "outside":
			return document;
		case "body":
			return document.body;
		case "head":
			return document.head;
		case "window":
			return window;
		default:
			return element;
	}
};

const eventsReaction: Reaction & { [NO_ROOT]: true } = {
	[NO_ROOT]: true,
	name: "events",
	attribute: "events",
	setup: (directive, context) => {
		const reference = directive.reference;
		if (!reference || reference.type !== "action") {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires an action.`,
				);
			return;
		}
		if (!reference.scope) {
			if (__DEV__)
				context.warn(
					`Cannot infer a store for the reference "${reference.raw}".`,
				);
			return;
		}

		const config = parseSpecifier(directive, context);
		if (!config) {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires an event specifier.`,
				);
			return;
		}

		const { element } = directive;
		const { eventName, flags } = config;
		const target = getTarget(element, config.target);
		const capture = flags.has("capture");
		const passive = flags.has("passive");
		const prevent = flags.has("prevent");
		if (__DEV__ && passive && prevent)
			context.warn(
				`The "${directive.attributeName}" directive can't prevent the default action of a passive listener.`,
			);
		// Only passed when needed, since browsers read an options object on
		// every call, and each loop item adds its own listeners. `prevent`
		// passes `passive: false`, since browsers make some listeners on the
		// page, such as `window.touchmove`, passive by default.
		const listenerOptions =
			passive || prevent
				? { capture, passive }
				: capture
					? { capture }
					: undefined;
		const call = (event: Event) => callAction(reference, event, context);

		if (config.target === "outside") {
			return listenOutside(
				element,
				config,
				call,
				reference.scope,
				listenerOptions ?? {},
			);
		}

		// The element's own events belong to one element, and each loop item
		// calls its action with its own item, so neither is shared.
		if (target === element || reference.loop) {
			const { listener, cancel } = createListener(
				config,
				call,
				reference.scope,
			);
			target.addEventListener(eventName, listener, listenerOptions);
			return () => {
				target.removeEventListener(eventName, listener, capture);
				cancel();
			};
		}

		let targetRegistrations = eventRegistrations.get(target);
		if (!targetRegistrations) {
			targetRegistrations = new Map();
			eventRegistrations.set(target, targetRegistrations);
		}
		const registrations = targetRegistrations;

		// Identical listeners on a shared target (document, window) run once.
		const registrationKey = `${directive.specifier}:${reference.scope}:${reference.key}`;
		let registration = registrations.get(registrationKey);
		if (registration) {
			registration.count += 1;
		} else {
			const { listener, cancel } = createListener(
				config,
				call,
				reference.scope,
			);
			target.addEventListener(eventName, listener, listenerOptions);
			registration = { count: 1, listener, cancel };
			registrations.set(registrationKey, registration);
		}

		const owned = registration;
		return () => {
			owned.count -= 1;
			if (owned.count > 0) return;
			target.removeEventListener(eventName, owned.listener, capture);
			owned.cancel();
			if (registrations.get(registrationKey) === owned) {
				registrations.delete(registrationKey);
			}
		};
	},
};

export default eventsReaction;
