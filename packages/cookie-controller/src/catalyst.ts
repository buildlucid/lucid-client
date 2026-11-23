import { defineStore } from "@lucidclient/catalyst";
import type { StateSetter } from "@lucidclient/catalyst/types";
import lib from "./lib/index.js";
import S from "./state.js";

type Consent = Record<string, boolean>;

type ConsentState = {
	granted: Consent;
	decided: boolean;
};

/**
 * Whether the visitor has made a choice
 * - Before init, this is read from the cookie, as getConsent is
 */
const isDecided = () =>
	S.initialised ? S.state.decided : lib.readCookie()?.decided === true;

/**
 * Copies the library's consent into a store
 * - Writes only what changed, so the store's saveGranted effect is not re-run by its own reset
 */
const syncConsent = (setState: StateSetter<ConsentState>) => {
	const consent = lib.getConsent();
	const decided = isDecided();
	setState((draft) => {
		for (const [category, consented] of Object.entries(consent)) {
			draft.granted[category] = consented;
		}
		for (const category of Object.keys(draft.granted)) {
			if (!Object.hasOwn(consent, category)) delete draft.granted[category];
		}
		draft.decided = decided;
	});
};

/**
 * A Catalyst store that mirrors the visitor's consent, for markup that depends on it
 * - `$granted.{category}` and `$denied.{category}` read a category's consent, and `$decided` whether the visitor has chosen
 * - `data-model` on `$granted.{category}` saves that category straight away, as updateConsent does
 * - `@acceptAll`, `@rejectAll`, `@saveDetails`, `@openDetails` and `@closeDetails` call the matching methods
 * - Register it under any scope: `Catalyst.start({ stores: { consent: consentStore } })`
 */
export const consentStore = defineStore({
	state: (): ConsentState => ({
		granted: lib.getConsent(),
		decided: isDecided(),
	}),
	computed: ({ state }) => ({
		/** The opposite of `granted`, as Catalyst references have no negation */
		denied: (): Consent =>
			Object.fromEntries(
				Object.entries(state.granted).map(([category, consented]) => [
					category,
					!consented,
				]),
			),
	}),
	actions: () => ({
		acceptAll: () => lib.acceptAll(),
		rejectAll: () => lib.rejectAll(),
		saveDetails: () => lib.saveDetails(),
		openDetails: () => lib.openDetails(),
		closeDetails: () => lib.closeDetails(),
	}),
	effects: ({ state, setState, effect }) => ({
		/** Saves the categories `data-model` changes, then resets any the library did not accept, such as `essential` */
		saveGranted: effect(
			() => ({ ...state.granted }),
			(granted, { isInitial }) => {
				if (isInitial) return;
				const saved = lib.getConsent();
				const changed: Consent = {};
				for (const [category, consented] of Object.entries(granted)) {
					if (saved[category] !== consented) changed[category] = consented;
				}
				if (Object.keys(changed).length === 0) return;
				lib.updateConsent(changed);
				syncConsent(setState);
			},
		),
	}),
	init: ({ setState }) => {
		const listener = () => syncConsent(setState);
		// Consent can change between the state being created and this hook running.
		listener();
		S.listeners.add(listener);
		return () => {
			S.listeners.delete(listener);
		};
	},
});
