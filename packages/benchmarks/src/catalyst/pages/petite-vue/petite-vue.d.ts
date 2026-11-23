// petite-vue's package.json `exports` has no `types` condition, so TypeScript
// can't find its types. These cover what the pages use, and type `this` in the
// app's methods as its data.
declare module "petite-vue" {
	type App = {
		mount(element?: string | Element | null): App;
		unmount(): void;
	};
	export const createApp: <T extends object>(data?: T & ThisType<T>) => App;
}
