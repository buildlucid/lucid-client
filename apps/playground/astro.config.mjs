import { Readable } from "node:stream";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A body the mock endpoints couldn't read, answered with a 400 */
class UnreadableBody extends Error {}

/** Reads a posted form from a Node request */
const readForm = async (req) => {
	if (req.method !== "POST") return new FormData();
	const headers = Object.entries(req.headers).filter(
		(entry) => typeof entry[1] === "string",
	);
	const request = new Request(`http://localhost${req.url}`, {
		method: "POST",
		headers,
		body: Readable.toWeb(req),
		duplex: "half",
	});
	return request.formData().catch(() => {
		throw new UnreadableBody();
	});
};

const sendJson = (res, status, body) => {
	res.statusCode = status;
	if (body === undefined) {
		res.end();
		return;
	}
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
};

const size = (bytes) =>
	bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;

const TOKENS = ["cf-turnstile-response", "g-recaptcha-response", "_captcha"];

/**
 * The responses each mock submit endpoint gives, as [status, JSON body]. A
 * status of 204 sends no body.
 */
const scenarios = {
	success: async () => {
		await wait(400);
		return [200, { message: "Thanks, we'll be in touch soon." }];
	},
	empty: async () => {
		await wait(300);
		return [204];
	},
	errors: async () => {
		await wait(300);
		return [
			422,
			{
				message: "Some answers need checking.",
				errors: {
					email: ["That email address is already registered."],
					"files.0": "Each file must be smaller than 1 MB.",
					unknown: "Something else went wrong.",
				},
			},
		];
	},
	"error-list": async () => {
		await wait(300);
		return [
			400,
			{
				message: "Some answers were refused.",
				errors: [{ name: "email", message: "Use a work email address." }],
			},
		];
	},
	slow: async () => {
		await wait(2500);
		return [200, { message: "That took a while, but it's sent." }];
	},
	redirect: async () => [
		200,
		{ redirect: "/forms/sending?redirected=1#redirect" },
	],
	echo: async (data) => {
		await wait(300);
		const received = Array.from(data, ([name, value]) =>
			typeof value === "string"
				? name
				: `${name}: ${value.name} (${size(value.size)})`,
		);
		return [
			200,
			{
				message: received.length
					? `Received ${received.join(", ")}.`
					: "Received nothing.",
			},
		];
	},
	captcha: async (data) => {
		await wait(300);
		const field = TOKENS.find((name) => data.has(name)) ?? "_captcha";
		const token = TOKENS.find((name) => String(data.get(name) ?? "").trim());
		if (!token)
			return [
				422,
				{
					message: "The security check wasn't passed.",
					errors: { [field]: "Complete the security check and try again." },
				},
			];
		const value = String(data.get(token));
		return [200, { message: `Received ${token}: ${value.slice(0, 18)}…` }];
	},
};

/**
 * Mock submit endpoints for the forms pages, at /mock/forms/<scenario>, so
 * every kind of response can be tried without a server. Only the dev server
 * has them.
 */
const mockForms = () => ({
	name: "playground-mock-forms",
	configureServer(server) {
		server.middlewares.use(async (req, res, next) => {
			const scenario = req.url?.match(
				/^\/mock\/forms\/([\w-]+)\/?(?:\?|$)/,
			)?.[1];
			if (!scenario) return next();
			if (scenario === "network") {
				req.socket.destroy();
				return;
			}
			if (scenario === "html-error") {
				await wait(300);
				res.statusCode = 500;
				res.setHeader("content-type", "text/html");
				res.end("<h1>Internal Server Error</h1>");
				return;
			}
			if (!Object.hasOwn(scenarios, scenario)) return next();
			try {
				const [status, body] = await scenarios[scenario](await readForm(req));
				sendJson(res, status, body);
			} catch (error) {
				if (error instanceof UnreadableBody)
					sendJson(res, 400, { message: "The form data couldn't be read." });
				else sendJson(res, 500, { message: "The mock endpoint failed." });
			}
		});
	},
});

// https://astro.build/config
export default defineConfig({
	// Keeps the whitespace of scenario markup, which the "Markup" panels show.
	compressHTML: false,
	// The toolbar is appended to <body>, so focus traps would make it inert and
	// it would sit over the activity log.
	devToolbar: { enabled: false },
	redirects: {
		"/catalyst": "/catalyst/stores",
	},
	vite: {
		plugins: [tailwindcss(), mockForms()],
	},
});
