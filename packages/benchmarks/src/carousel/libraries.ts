import type { Library } from "../suite.ts";

/**
 * Lucid Carousel comes first, as the suite's own library. Embla, Swiper and
 * Splide move slides with transforms; Swiper's CSS mode, Blossom and Swiffy
 * Slider scroll them with CSS scroll snapping, as Lucid Carousel does.
 */
export const libraries: Library[] = [
	{
		id: "carousel",
		name: "Lucid Carousel",
		package: "@lucidclient/carousel",
		homepage: "https://github.com/ProtoDigitalUK/lucid_client",
		kind: "CSS scroll snap",
	},
	{
		id: "embla",
		name: "Embla Carousel",
		package: "embla-carousel",
		homepage: "https://www.embla-carousel.com/",
		kind: "Transforms",
	},
	{
		id: "swiper",
		name: "Swiper",
		package: "swiper",
		homepage: "https://swiperjs.com/",
		kind: "Transforms",
	},
	{
		id: "splide",
		name: "Splide",
		package: "@splidejs/splide",
		homepage: "https://splidejs.com/",
		kind: "Transforms",
	},
	{
		id: "swiper-css",
		name: "Swiper (CSS mode)",
		package: "swiper",
		homepage: "https://swiperjs.com/swiper-api#param-cssMode",
		kind: "CSS scroll snap",
	},
	{
		id: "blossom",
		name: "Blossom Carousel",
		package: "@blossom-carousel/core",
		homepage: "https://www.blossom-carousel.com/",
		kind: "CSS scroll snap",
	},
	{
		id: "swiffy",
		name: "Swiffy Slider",
		package: "swiffy-slider",
		homepage: "https://www.swiffyslider.com/",
		kind: "CSS scroll snap",
	},
];
