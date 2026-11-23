import disposeSubtree from "./dispose-subtree.js";
import { takeReleased } from "./released.js";

const registerRemovalObserver = () => {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.removedNodes) {
				if (!(node instanceof Element)) continue;
				// Moved nodes are reconnected by the time the observer runs.
				if (node.isConnected) continue;
				if (takeReleased(node)) continue;
				disposeSubtree(node);
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
	return observer;
};

export default registerRemovalObserver;
