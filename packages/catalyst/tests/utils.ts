import { vi } from "vite-plus/test";
import Runtime from "../src/runtime/catalyst.js";

export const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

type ConsoleCapture = {
	errors: unknown[][];
	warnings: unknown[][];
	allowErrors: boolean;
};

export const consoleCapture: ConsoleCapture = {
	errors: [],
	warnings: [],
	allowErrors: false,
};

/** Lets a test that deliberately triggers failures log errors. */
export const allowConsoleErrors = () => {
	consoleCapture.allowErrors = true;
};

export const catalystWarnings = () =>
	consoleCapture.warnings
		.map((args) => String(args[0]))
		.filter((message) => message.startsWith("[Catalyst]"));

export const installConsoleCapture = () => {
	consoleCapture.errors = [];
	consoleCapture.warnings = [];
	consoleCapture.allowErrors = false;
	vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		consoleCapture.errors.push(args);
	});
	vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
		consoleCapture.warnings.push(args);
	});
};

/** Solid reports dev diagnostics as `[CODE] message`. */
const isSolidDiagnostic = (args: unknown[]) =>
	/^\[[A-Z][A-Z_]+\]/.test(String(args[0]));

export const assertCleanConsole = () => {
	const diagnostics = [...consoleCapture.errors, ...consoleCapture.warnings]
		.filter(isSolidDiagnostic)
		.map((args) => String(args[0]));
	if (diagnostics.length) {
		throw new Error(`Unexpected Solid diagnostics:\n${diagnostics.join("\n")}`);
	}
	if (!consoleCapture.allowErrors && consoleCapture.errors.length) {
		const messages = consoleCapture.errors.map((args) =>
			args
				.map((arg) => (arg instanceof Error ? arg.stack : String(arg)))
				.join(" "),
		);
		throw new Error(`Unexpected console errors:\n${messages.join("\n")}`);
	}
};

/** The running store for a scope. */
export const getStore = (scope: string) => Runtime.stores.get(scope);

/** Writes one state value of a running store, as an action would. */
export const setStoreState = (scope: string, key: string, value: unknown) => {
	Runtime.stores.get(scope)?.setState((state) => {
		state[key] = value;
	});
};
