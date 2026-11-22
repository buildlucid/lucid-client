import Elements, { storeModule } from "@lucidclient/elements";
import { events, dom, trap } from "@lucidclient/elements/handlers";
import { speculateLinks } from "@lucidclient/speculate";
import "./speculate/speculator";
import bindsStore from "./elements/binds";
import exampleStore from "./elements/example";
import loopsStore from "./elements/loops";
import navStore from "./elements/nav";

storeModule("loops", loopsStore);
storeModule("example", exampleStore);
storeModule("nav", navStore);
storeModule("binds", bindsStore);

Elements.start({
	debug: true,
	handlers: [events, dom, trap],
});

speculateLinks();
