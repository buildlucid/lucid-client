/** The markup every test needs: a details element with two optional categories. */
export const detailsMarkup = `
	<div data-cookie--details>
		<input type="checkbox" data-cookie--category="essential" />
		<input type="checkbox" data-cookie--category="analytics" />
		<input type="checkbox" data-cookie--category="marketing" />
		<button data-cookie--action="save">Save</button>
	</div>
`;

export const click = (selector: string) => {
	const element = document.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`No element matches ${selector}`);
	element.click();
};
