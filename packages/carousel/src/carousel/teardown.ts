import type { Context } from "./context.js";

/** Stops the carousel and puts back everything it changed in the markup */
const teardown = (ctx: Context) => {
	if (ctx.destroyed) return;
	ctx.destroyed = true;

	ctx.abort.abort();
	ctx.mutation.disconnect();
	ctx.resize.disconnect();
	ctx.autoplay.destroy();
	cancelAnimationFrame(ctx.measureFrame);
	clearTimeout(ctx.settleTimer);

	for (const entry of ctx.generated.values())
		for (const marker of entry.markers) marker.remove();
	ctx.generated.clear();

	ctx.held.close();
	if (ctx.trackStyle === null && ctx.track.getAttribute("style") === "")
		ctx.track.removeAttribute("style");
	for (const [status, nodes] of ctx.statusNodes)
		status.replaceChildren(...nodes);
	ctx.rec.restore();
	ctx.rec.close();
	ctx.subscribers.clear();
};

export default teardown;
