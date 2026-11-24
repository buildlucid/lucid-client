import { afterEach, vi } from "vite-plus/test";
import forms from "../src/index.js";

afterEach(() => {
	forms.destroy();
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
