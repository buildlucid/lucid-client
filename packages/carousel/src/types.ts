/** The values a message can use. Templates write them as `{n}` and `{count}`. */
export type MessageTokens = {
	/** The slide or page number, from 1 */
	n: number;
	/** The number of slides or pages */
	count: number;
};

/** A template such as `"Slide {n} of {count}"`, or a function for text that changes with a number */
export type Message = string | ((tokens: MessageTokens) => string);

export type Messages = {
	/** The carousel's `aria-roledescription`. Defaults to `"carousel"` */
	carouselRole: Message;
	/** The `aria-roledescription` of slides that get slide semantics. Defaults to `"slide"` */
	slideRole: Message;
	/**
	 * The `aria-label` given to slides without a name of their own. List items are left alone, so lists keep their semantics.
	 * - Defaults to `"{n} of {count}"`, where `{n}` is the slide number and `{count}` the number of slides
	 */
	slide: Message;
	/**
	 * The `aria-label` given to markers without a name of their own
	 * - Defaults to `"Go to slide {n}"`, where `{n}` is the page number for generated markers, or the slide number for your own
	 */
	marker: Message;
	/** The `aria-label` of a markers container that gets `role="group"`. Defaults to `"Choose a slide"` */
	markers: Message;
	/**
	 * What the `data-carousel--status` element announces after a visitor moves the carousel
	 * - Defaults to `"Slide {n} of {count}"`, where `{n}` is the page number and `{count}` the number of pages
	 */
	status: Message;
	/** The `aria-label` of an icon-only `prev` control. Defaults to `"Previous slide"` */
	prev: Message;
	/** The `aria-label` of an icon-only `next` control. Defaults to `"Next slide"` */
	next: Message;
	/** The `aria-label` of an icon-only toggle while autoplay is stopped. Defaults to `"Start automatic slide show"` */
	play: Message;
	/** The `aria-label` of an icon-only toggle while autoplay is running. Defaults to `"Stop automatic slide show"` */
	pause: Message;
};

declare const dragBrand: unique symbol;

/** Mouse dragging, imported from `@lucidclient/carousel/drag` */
export type Drag = { readonly [dragBrand]: true };

export type Options = {
	/**
	 * The text the library writes, for translating or rewording. A carousel's own `data-carousel--message-{name}` attributes win over these.
	 */
	messages?: Partial<Messages>;
	/** Mouse dragging for carousels with `data-carousel--drag`, from `@lucidclient/carousel/drag` */
	drag?: Drag;
};

export type CarouselState = {
	/** The current page, from 0. A page is a position the carousel snaps to, so several slides in view share one. */
	index: number;
	/** The number of pages */
	count: number;
	/** `true` while scrolled to the start. Always `false` while looping. */
	atStart: boolean;
	/** `true` while scrolled to the end. Always `false` while looping. */
	atEnd: boolean;
	/** `true` when the slides overflow the track, so there is somewhere to scroll to */
	scrollable: boolean;
	/** `true` while autoplay is on. It stays `true` while it waits for the pointer to leave or the carousel to scroll back into view. */
	playing: boolean;
};

export type CarouselChange = {
	index: number;
	previousIndex: number;
	count: number;
};

export type Carousel = {
	/** The `data-carousel` element */
	readonly element: HTMLElement;
	/** The `data-carousel--track` element, which scrolls */
	readonly track: HTMLElement;
	/** The current state, as a copy */
	readonly state: CarouselState;
	/** Scrolls to the next page. Wraps around when looping or rewinding. */
	next: () => void;
	/** Scrolls to the previous page. Wraps around when looping or rewinding. */
	prev: () => void;
	/** Scrolls to a page, from 0 */
	goTo: (index: number) => void;
	/** Starts autoplay, using `data-carousel--autoplay`'s interval or 5000ms */
	play: () => void;
	/** Stops autoplay until it is started again */
	pause: () => void;
	/** Starts or stops autoplay */
	toggle: () => void;
	/** Runs the listener after every state change. Returns a function that removes it. */
	subscribe: (listener: (state: CarouselState) => void) => () => void;
	/** Re-reads the options, slides, controls and markers, and measures again */
	refresh: () => void;
	/** Removes the listeners and the attributes the library added */
	destroy: () => void;
};
