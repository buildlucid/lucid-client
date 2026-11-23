/** Inline icons for the carousel scenarios' controls. */

const svg = (path: string) =>
	`<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const prevIcon = svg('<path d="m15 18-6-6 6-6" />');
export const nextIcon = svg('<path d="m9 18 6-6-6-6" />');
export const upIcon = svg('<path d="m18 15-6-6-6 6" />');
export const downIcon = svg('<path d="m6 9 6 6 6-6" />');
export const pauseIcon = svg(
	'<rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />',
);
export const playIcon = svg('<path d="M7 5v14l12-7z" />');

/** One hue per slide, so slides are easy to tell apart. */
export const hues = [277, 200, 160, 95, 40, 10, 330, 240, 130, 60];
