# Cookie Controller

> Part of the Lucid Client suite

A lightweight, bring your own markup and styles, cookie consent solution. Perfect for agencies, enterprise teams and individuals who need full control over their cookie consent implementation and UX.

## Features

- No Markup/Styles: This library supplies no styles or markup allowing you to fully customise the look and feel of the cookie controller to match your website's design.
- Tiny Footprint: The library is only **~3.6KB** minified and gzipped.
- Attribute Driven: Hook up your markup using `data-cookie--*` attributes entirely.
- Consent Callbacks: Read the current preferences on load and after each saved decision.
- Category Consent: Grant or withdraw individual categories from anywhere on the page, such as an "Allow marketing cookies" button on an embed placeholder.
- Scripts and Media: Hold back scripts, iframes, images, video and audio until their category is consented.
- Google Tag Manager: Drive Google consent mode from the visitor's choices, so Tag Manager loads tags based on consent.
- Consent Records: Use the generated UUID and the consent callback to record the users consent within your own system.
- Versioning: Ask for fresh consent when the cookie policy version changes.
- Storage Config: Confure the cookie used to store the users preferences.
- Accessibility: Follows GOV.UK's cookie banner pattern, with a named banner that doesn't interrupt, a modal `<dialog>` for settings, focus that is never lost, and a status that confirms each choice. See [Accessibility](#accessibility).
- Translatable: Every message the library writes can be set in `init` or with attributes. See [Messages](#messages).
- Development Warnings: Markup mistakes are pointed out while you develop, and left out of production builds.
- Refresh: Pick up markup added or replaced after initialisation, such as after a client side navigation.
- Destroy: Destroy the cookie controller instance and remove all event listeners. Useful for using within SPA's.

## Examples

- [Basic](https://github.com/buildlucid/lucid-client/blob/master/packages/cookie-controller/examples/basic.html)
- [Tailwind](https://github.com/buildlucid/lucid-client/blob/master/packages/cookie-controller/examples/tailwind.html)

## Getting Started

### Installation

To install the Cookie Controller library, run the following command:

```bash
npm install @lucidclient/cookie-controller
```

### Usage

All config for the init function is optional.

```typescript
import cookieController from "@lucidclient/cookie-controller";

cookieController.init({
  onConsentChange: (data) => {
    console.log(data);
  },
  cookies: {
    analytics: ["_ga", "_gid"],
    marketing: ["mkto"],
  },
});
```

### Types

The following `Options` type is used for the init functions options parameter.

```typescript
type ConsentChange = {
  /**
   * The consent change type
   * - accept: when the accept button is clicked
   * - reject: when the reject button is clicked
   * - save: when the save button is clicked
   * - update: when individual categories are updated via updateConsent or a category scoped accept/reject button
   * - load: when the library is initialised
   */
  type: "accept" | "reject" | "save" | "update" | "load";
  /**
   * The users UUID
   */
  uuid: string;
  /**
   * The version of the cookie policy
   */
  policyVersion?: string;
  /**
   * All of the cookie category states, including the always consented "essential" category
   */
  categories: Array<{
    category: string;
    consented: boolean;
    cookies: Array<string>;
  }>;
};

type StorageOptions = {
  path?: string;
  domain?: string;
  sameSite?: "Strict" | "Lax" | "None";
  secure?: boolean;
  /**
   * When the preference cookie expires, as a number of days from the visitor's last decision or a date
   * - Defaults to 180 days
   * - Pass 0 for a session cookie that is removed when the browser closes
   */
  expires?: number | Date;
};

type Options = {
  /**
   * A list of cookies that get added when a certain category is consented
   * - Ie: analytics: ["_ga", "_gid"]
   * - The "essential" category is always consented and always includes the cookie this library uses to store preferences
   *
   * Note that these are just returned in the onConsentChange callback, they are not added/removed from the users cookies
   */
  cookies?: Record<string, Array<string>>;
  /**
   * Runs on load and after a decision is saved
   */
  onConsentChange?: (data: ConsentChange) => void;
  /**
   * The current version of your cookie policy
   * - Choices saved for another version are ignored, so visitors are asked again
   */
  policyVersion?: string;
  /**
   * Runs on load when the visitor's saved choices are for a different policyVersion
   */
  onPolicyVersionChange?: (oldVersion: string, newVersion: string) => void;
  /**
   * Configure the options for the cookie used to store the user's preferences
   */
  storage?: StorageOptions;
  /**
   * The text the library writes, for translating or rewording. See Messages.
   */
  messages?: Partial<Messages>;
};
```

### Methods

| Method | Description |
| --- | --- |
| `init(options?)` | Initialises the library. Calling it again re-initialises it. |
| `refresh()` | Re-queries the markup and re-applies its attributes and visibility, without re-reading the cookie or firing callbacks. |
| `destroy()` | Removes all event listeners and the accessibility attributes the library added. |
| `getConsent()` | Returns the consent for every category, for example `{ analytics: false, marketing: true, essential: true }`. |
| `getConsent(category)` | Returns whether a category is consented. `"essential"` is always `true`, and unknown categories return `undefined`. |
| `updateConsent(categories)` | Updates individual categories, for example `{ marketing: true }`. Other categories keep their saved value, or stay off if the visitor has not decided yet. Saves the decision, closes the banner and fires `onConsentChange` with the `update` type. |
| `acceptAll()` / `rejectAll()` | Accepts or rejects all categories, then closes the banner and details elements. |
| `saveDetails()` | Saves the checkbox choices in the details element, then closes it. |
| `openDetails()` | Opens the details element with its checkboxes set to the saved choices. |
| `closeDetails()` | Closes the details element without saving, discarding unsaved checkbox edits. |

Each method has a matching `data-cookie--action` value: `accept`, `reject`, `save`, `details` (which toggles the details element) and `dismiss`.

`getConsent` also works before `init`, as it reads the saved choices straight from the cookie. Before `init` it cannot check the policy version for you, so pass it to ignore choices saved for another version: `getConsent({ policyVersion: "1.0.2" })`.

### HTML Markup

On each page, include one `data-cookie--details` element and, optionally, one `data-cookie--banner` element. Leave it out to show your own banner from `onConsentChange` instead. With the `data-cookie--action` attributes, you can add as many as you like.

```html
<dialog data-cookie--details aria-label="Cookie settings" hidden>
  <button data-cookie--action="dismiss">Close</button>
  <button data-cookie--action="accept">Accept Recommended</button>
  <button data-cookie--action="reject">Reject</button>
  <a href="https://www.example.com/privacy-policy" target="_blank">
    Cookie Policy
  </a>
  <ul>
    <li>
      <p>Essential Cookies:</p>
      <p>...</p>
    </li>
    <li>
      <input id="analytics" type="checkbox" data-cookie--category="analytics" />
      <label for="analytics">Analytics:</label>
      <p>...</p>
    </li>
    <li>
      <input id="marketing" type="checkbox" data-cookie--category="marketing" />
      <label for="marketing">Marketing:</label>
      <p>...</p>
    </li>
  </ul>
  <button data-cookie--action="save">Save My Preferences</button>
</dialog>

<div data-cookie--banner aria-label="Cookies on Example" hidden>
  <button data-cookie--action="accept">Accept All</button>
  <button data-cookie--action="reject">Reject</button>
  <button data-cookie--action="details">Details</button>
  <button data-cookie--action="dismiss">Close</button>
</div>

<button data-cookie--action="details">Open Cookie Modal</button>

<p data-cookie--status></p>
```

> For a styled example, see `examples/tailwind.html`.

Use a native `<dialog>` for the details element to get modal focus management and Escape-to-close. Checkbox edits take effect after Save. The `data-cookie--status` element confirms each choice. See [Accessibility](#accessibility).

A `dismiss` action closes whichever element it is in:

- Inside the `data-cookie--banner` element, it hides the banner for the current page without saving a decision. No consent is given, and the banner shows again on the next page until the visitor chooses.
- Anywhere else, it closes the details element and discards unsaved checkbox edits. Visitors who have yet to decide return to the banner, unless they closed it on this page.

Version 1.0.0 asks visitors who have a 0.1.0 preference cookie to choose again, since that format also saved unsaved checkbox edits.

#### Category Buttons

Add a `data-cookie--category` attribute to an `accept` or `reject` action to update only that category. This works anywhere on the page, for example on an embed placeholder:

```html
<div class="video-placeholder">
  <p>This video needs marketing cookies.</p>
  <button data-cookie--action="accept" data-cookie--category="marketing">
    Allow marketing cookies
  </button>
</div>
```

The category needs a matching checkbox in the `data-cookie--details` element.

#### Scripts and Media

Give a script `type="text/plain"` and a `data-cookie--category` attribute to stop it running until that category is consented. Browsers do not run or download scripts with a type they do not recognise.

```html
<script
  type="text/plain"
  data-cookie--category="analytics"
  src="https://www.example.com/analytics.js"
></script>

<script type="text/plain" data-cookie--category="analytics">
  console.log("Analytics consented");
</script>

<!-- Add data-cookie--type to keep a non classic type, such as a module -->
<script type="text/plain" data-cookie--type="module" data-cookie--category="analytics">
  import "https://www.example.com/analytics.mjs";
</script>
```

For iframes, images, video and audio, use `data-cookie--src` and `data-cookie--srcset` in place of `src` and `srcset`. The `source` elements inside a `video`, `audio` or `picture` element are swapped too.

```html
<iframe
  data-cookie--category="marketing"
  data-cookie--src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
  title="Video"
></iframe>

<img data-cookie--category="marketing" data-cookie--src="https://www.example.com/pixel.gif" alt="" />

<video data-cookie--category="marketing" controls>
  <source data-cookie--src="https://cdn.example.com/video.mp4" type="video/mp4" />
</video>
```

- Elements are activated on load for visitors who have already consented, and whenever consent is given. Each element is only activated once.
- Activated elements get a `data-cookie--activated` attribute, which you can use to hide placeholders with CSS.
- Scripts run in page order, and each external script loads before the next one runs, unless it has the `async` attribute. A CSP `nonce` is kept.
- Space separate categories to require all of them, for example `data-cookie--category="analytics marketing"`.
- Withdrawing consent does not unload anything that has already run or loaded. Reload the page, or clean up in `onConsentChange`.
- Tracking pixels inside `<noscript>` only render without JavaScript, so they cannot be held back. Use the script version of the pixel instead.
- Third party fonts and stylesheets are not covered. Host them yourself instead.

#### Essential Cookies

The `essential` category is always consented, and it always lists the `CookieController` cookie this library uses to store preferences. Add any other essential cookies with `cookies.essential`. If you add a checkbox with `data-cookie--category="essential"`, it is shown checked and disabled.

#### Dynamic Markup

Action elements work as soon as they are added to the page. If the `data-cookie--details` or `data-cookie--banner` elements, the category checkboxes, or consent gated scripts and media are added or replaced after `init`, such as after a client side navigation, call `refresh()`.

## Accessibility

The library follows GOV.UK's [cookie banner](https://design-system.service.gov.uk/components/cookie-banner/) pattern and fills in what the markup leaves out. Anything you set yourself is kept, and `destroy` removes what the library added.

- A `div` banner gets `role="region"`, and a banner without a name gets `aria-label="Cookie consent"`, so it can be found as a landmark. It doesn't take focus or read itself out when it appears.
- A `<dialog>` details element opens with `showModal()`, which keeps focus inside it until it closes, and Escape closes it without saving. Any other element gets `role="dialog"` and `tabindex="-1"`, takes focus when it opens and closes with Escape, but isn't modal.
- A details element without a name gets `aria-label="Cookie settings"`, and `details` actions get `aria-controls`.
- Closing the details element gives focus back to the element that opened it, once the banner it may be in is showing again.
- `data-cookie--status` elements become polite live regions, and say what was chosen after each decision, such as "Your cookie preferences have been saved." When a decision hides the element that had focus, focus moves to the first status element rather than being lost.

Your markup and CSS still need to:

- Put the banner at the start of the `<body>`, so it is the first thing keyboard and screen reader users reach.
- Keep a sticky or fixed banner from covering focused content (WCAG 2.4.11). Leave it in the page flow, or add `scroll-padding` the height of the banner.
- Keep the status in the page from the start rather than `display: none`, so screen readers know of it before it is written to. A visible message, as GOV.UK shows, also shows sighted keyboard users where focus went.
- Give every category checkbox a `<label>`. Use checkboxes or radios rather than `role="switch"`, as a switch suggests a choice takes effect straight away, and these take effect on Save.
- Give Accept and Reject the same prominence, and show a focus style on every control.

The [development build](#development-build) warns about a details element that isn't a `<dialog>` and a category checkbox without a label.

## Messages

Translate or reword the text the library writes. `init` sets the messages:

```typescript
cookieController.init({
  messages: {
    banner: "Consentement aux cookies",
    details: "Paramètres des cookies",
    accepted: "Vous avez accepté tous les cookies.",
    rejected: "Vous avez refusé les cookies facultatifs.",
    saved: "Vos préférences ont été enregistrées.",
    updated: "Vos préférences ont été mises à jour.",
  },
});
```

A status element can set its own with `data-cookie--message-{name}` attributes, which win over `init`:

```html
<p data-cookie--status data-cookie--message-saved="Vos préférences ont été enregistrées."></p>
```

`banner` and `details` are only used for elements without an `aria-label` or `aria-labelledby`, so on a translated page, name them in the markup. An empty message passed to `init` writes nothing.

| Message | Default | Used for |
| --- | --- | --- |
| `banner` | `Cookie consent` | The banner's name, when it has none. |
| `details` | `Cookie settings` | The details element's name, when it has none. |
| `accepted` | `You've accepted all cookies.` | The status after `accept`. |
| `rejected` | `You've rejected optional cookies.` | The status after `reject`. |
| `saved` | `Your cookie preferences have been saved.` | The status after `save`. |
| `updated` | `Your cookie preferences have been updated.` | The status after one category is accepted or rejected, or after `updateConsent`. |

## Development Build

The library warns about markup it can't work with, such as a missing details element, a details element that isn't a `<dialog>`, a category checkbox without a label, or an unknown category passed to `updateConsent`. Warnings only log in the development build, which bundlers such as Vite and webpack pick through the `development` export condition while you develop. Production builds leave them out.

## Google Tag Manager

Google consent mode loads the Google tag on every page with consent denied, and Tag Manager only runs each tag once its consent types are granted. Set the default in the `<head>`, before the Tag Manager snippet:

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
</script>
<!-- Google Tag Manager snippet -->
```

Then update it from `onConsentChange`, which runs on every page load and after each decision. Map your categories to Google's consent types:

```javascript
import cookieController from "@lucidclient/cookie-controller";

const status = (consented) => (consented ? "granted" : "denied");

cookieController.init({
  onConsentChange: () => {
    const consent = cookieController.getConsent();
    gtag("consent", "update", {
      analytics_storage: status(consent.analytics),
      ad_storage: status(consent.marketing),
      ad_user_data: status(consent.marketing),
      ad_personalization: status(consent.marketing),
    });
  },
});
```

In Tag Manager, use each tag's consent settings to require the matching consent type. This works for non Google tags too.

## GDPR Compliance Tips

Our cookie controller is developed with GDPR considerations in mind. While this tool offers functionalities aligning with GDPR requirements, full compliance depends on how it is implemented within your website's broader context and architecture.

Here are some tips for achieving compliance:

- Cookie Policy Link: Include a link to your cookie or privacy policy.
- Define Cookie Controls: Clearly define what each checkbox controls, providing details like the name, duration, and purpose of the cookies.
- Necessary Cookies: Inform users about necessary cookies. These are for informational purposes only, so do not give them a `data-cookie--category` checkbox they can toggle. The `essential` category is always consented, and a checkbox with `data-cookie--category="essential"` is shown checked and disabled.
- Equal Prominence: Ensure 'Accept' and 'Reject' options are equally prominent in your design.
- Accessibility: See [Accessibility](#accessibility) for what the library does and what your markup needs.
- Consent Recording: Save the consent data to ensure compliance with the consent recording requirements of GDPR.
- Consent Lifetime: Choices are kept for 180 days by default, then visitors are asked again. Change this with `storage.expires`, keeping in mind that some regulators, such as France's CNIL, recommend asking again at least every 6 months.

Please note this is not an exhaustive list, and we recommend seeking legal advice to ensure full compliance.
