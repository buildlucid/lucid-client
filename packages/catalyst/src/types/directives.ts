export type StoreMemberReferenceType = "action" | "identifier" | "state";
export type LoopMemberReferenceKey = "index" | "indexOne" | "item";
export type MemberReferenceType = StoreMemberReferenceType | "loop";

/** The item a loop rendered an element for. `index` is reactive. */
export type LoopContext = {
	item: unknown;
	index: () => number;
	parent?: LoopContext;
	/** The store whose state the loop renders, which writes to its items. */
	scope?: string | null;
};

/**
 * The loop item an action was called from, passed to actions inside a loop:
 * after the `Event` for events, and as the only argument when an action
 * provides a value. Reading `index` in a tracked value keeps it up to date as
 * the item moves.
 */
export type LoopItem<T = unknown> = {
	readonly item: T;
	readonly index: number;
	readonly indexOne: number;
	/** The enclosing loop's item, for nested loops. */
	readonly parent: LoopItem | undefined;
};

export type StoreMemberReference = {
	raw: string;
	scope: string | null;
	type: StoreMemberReferenceType;
	key: string;
	path: string[];
	/** For an action inside a loop, the loop item its element belongs to. */
	loop?: LoopContext;
};

export type LoopMemberReference = {
	raw: string;
	scope: null;
	type: "loop";
	key: LoopMemberReferenceKey;
	path: string[];
	/** `undefined` when `$parent` traverses past the outermost loop. */
	context: LoopContext | undefined;
};

export type MemberReference = LoopMemberReference | StoreMemberReference;

export type Directive = {
	element: Element;
	reaction: string;
	attributeName: string;
	specifier: string;
	value: string;
	reference: MemberReference | null;
};
