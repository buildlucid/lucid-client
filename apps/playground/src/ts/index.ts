import Catalyst, { storeModule } from "@lucidclient/catalyst";
import {
	bind,
	dom,
	effects,
	events,
	loop,
	refs,
	trap,
} from "@lucidclient/catalyst/reactions";
import { speculateLinks } from "@lucidclient/speculate";
import "./speculate/speculator";
import bindsStore from "./catalyst/binds";
import exampleStore from "./catalyst/example";
import loopsStore from "./catalyst/loops";
import navStore from "./catalyst/nav";

storeModule("loops", loopsStore);
storeModule("example", exampleStore);
storeModule("nav", navStore);
storeModule("binds", bindsStore);

Catalyst.start({
	debug: true,
	reactions: [refs, bind, effects, loop, events, dom, trap],
});

speculateLinks();
