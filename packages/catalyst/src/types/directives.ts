export type StoreMemberReferenceType = "action" | "identifier" | "state";
export type LoopMemberReferenceKey = "index" | "indexOne" | "item";
export type MemberReferenceType = StoreMemberReferenceType | "loop";

/** The item a loop rendered an element for. `index` is reactive. */
export type LoopContext = {
	item: unknown;
	index: () => number;
	parent?: LoopContext;
};

export type StoreMemberReference = {
	raw: string;
	scope: string | null;
	type: StoreMemberReferenceType;
	key: string;
	path: string[];
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
