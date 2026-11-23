import { afterEach } from "vite-plus/test";
import cookieController from "../src/index.js";

export const clearCookie = () => {
	document.cookie = "CookieController=; path=/; max-age=0";
};

afterEach(() => {
	cookieController.destroy();
	clearCookie();
	document.body.innerHTML = "";
});
