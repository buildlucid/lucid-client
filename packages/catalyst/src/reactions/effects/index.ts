import { createEffect } from "solid-js";
import { error } from "../../runtime/log.js";
import { createOwnedRoot, runEffectCallback } from "../../runtime/reactive.js";
import type { Reaction, Store, StoreEffect } from "../../types/index.js";

type EffectRegistration = {
	count: number;
	dispose: () => void;
};

const effectRegistrations = new WeakMap<
	Store,
	Map<string, EffectRegistration>
>();

const isStoreEffect = (value: unknown): value is StoreEffect =>
	typeof value === "object" &&
	value !== null &&
	"compute" in value &&
	"effect" in value &&
	typeof value.compute === "function" &&
	typeof value.effect === "function";

const runStoreEffect = (store: Store, name: string, effect: StoreEffect) =>
	createOwnedRoot((disposeRoot) => {
		let isInitial = true;
		createEffect(() => effect.compute(), {
			effect: (value: unknown, previous?: unknown) =>
				runEffectCallback(() => {
					const context = { isInitial, previous };
					isInitial = false;
					return effect.effect(value, context);
				}),
			error: (cause: unknown) => {
				error(`The effect "${name}" on store "${store.key}" threw.`, cause);
			},
		});
		return disposeRoot;
	});

const effectsReaction: Reaction = {
	name: "effects",
	attribute: "effects",
	setup: (directive, context) => {
		const reference = directive.reference;
		if (!reference || reference.type !== "identifier") {
			context.warn(
				`The "${directive.attributeName}" directive requires a #effect name.`,
			);
			return;
		}
		if (!reference.scope) {
			context.warn(
				`Cannot infer a store for the reference "${reference.raw}".`,
			);
			return;
		}

		const store = context.getStore(reference.scope);
		if (!store) {
			context.warn(`Cannot find a store with the scope "${reference.scope}".`);
			return;
		}

		const type = directive.specifier === "global" ? "global" : "manual";
		const effect = store.effects[type][reference.key];
		if (!effect) {
			context.warn(
				`Cannot find ${type} effect "${reference.key}" on store "${reference.scope}".`,
			);
			return;
		}
		if (!isStoreEffect(effect)) {
			context.warn(
				`The ${type} effect "${reference.key}" on store "${reference.scope}" must be an object with "compute" and "effect" functions.`,
			);
			return;
		}

		let storeRegistrations = effectRegistrations.get(store);
		if (!storeRegistrations) {
			storeRegistrations = new Map();
			effectRegistrations.set(store, storeRegistrations);
		}
		const registrations = storeRegistrations;

		// Every directive that references the same store effect shares one run.
		const registrationKey = `${type}:${reference.key}`;
		let registration = registrations.get(registrationKey);
		if (registration) {
			registration.count += 1;
		} else {
			registration = {
				count: 1,
				dispose: runStoreEffect(store, reference.key, effect),
			};
			registrations.set(registrationKey, registration);
		}

		const owned = registration;
		return () => {
			owned.count -= 1;
			if (owned.count > 0) return;
			owned.dispose();
			if (registrations.get(registrationKey) === owned) {
				registrations.delete(registrationKey);
			}
		};
	},
};

export default effectsReaction;
