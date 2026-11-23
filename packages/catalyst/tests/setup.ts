import { afterEach, beforeEach, vi } from "vite-plus/test";
import Catalyst from "../src/index.js";
import Runtime from "../src/runtime/catalyst.js";
import { assertCleanConsole, installConsoleCapture, settle } from "./utils.js";

beforeEach(() => {
	installConsoleCapture();
});

afterEach(async () => {
	await settle();
	Catalyst.destroy();
	Runtime.reactions.clear();
	Runtime.storeDefinitions.clear();
	document.body.innerHTML = "";
	document.body.removeAttribute("style");
	try {
		assertCleanConsole();
	} finally {
		vi.restoreAllMocks();
	}
});
