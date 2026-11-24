import connectionProblem from "./connection-problem.js";
import createObserver from "./create-observer.js";
import destroy from "./destroy.js";
import initialise from "./initialise.js";
import intent from "./intent.js";
import linkUrl from "./link-url.js";
import log from "./log.js";
import parseLink from "./parse-link.js";
import prefetch from "./prefetch.js";
import refresh from "./refresh.js";
import rules from "./rules.js";
import scan from "./scan.js";
import speculate from "./speculate.js";
import support from "./support.js";
import whenIdle from "./when-idle.js";
import withoutHash from "./without-hash.js";

const lib = {
	initialise,
	refresh,
	destroy,
	connectionProblem,
	support,
	whenIdle,
	createObserver,
	intent,
	scan,
	parseLink,
	linkUrl,
	withoutHash,
	speculate,
	rules,
	prefetch,
	log,
};

export default lib;
