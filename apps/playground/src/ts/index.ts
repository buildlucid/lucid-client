import Catalyst from "@lucidclient/catalyst";
import { bind, dom, events, loop, trap } from "@lucidclient/catalyst/reactions";
import { speculateLinks } from "@lucidclient/speculate";
import "./speculate/speculator";
import binds from "./catalyst/binds";
import example from "./catalyst/example";
import loops from "./catalyst/loops";
import nav from "./catalyst/nav";

Catalyst.start({
	debug: true,
	stores: { loops, example, nav, binds },
	reactions: [bind, loop, events, dom, trap],
});

speculateLinks();
