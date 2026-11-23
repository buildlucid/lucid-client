import destroy from "./destroy.js";
import get from "./get.js";
import initialise from "./initialise.js";
import log from "./log.js";
import refresh from "./refresh.js";
import registerEvents from "./register-events.js";
import scan from "./scan.js";

const lib = {
	initialise,
	refresh,
	destroy,
	get,
	scan,
	registerEvents,
	log,
};

export default lib;
