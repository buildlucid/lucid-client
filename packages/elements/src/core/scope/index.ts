import valueHasScope from "./has-scope.js";
import removeScope from "./remove-scope.js";
import scopeValue from "./scope-value.js";
import splitValue from "./split-value.js";
import valueIsScoped from "./value-is-scoped.js";

const scope = {
	scopeValue,
	valueIsScoped,
	removeScope,
	splitValue,
	valueHasScope,
};

export default scope;
