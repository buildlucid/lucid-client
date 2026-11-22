# Cookie Controller

> Part of the Lucid Client suite

A lightweight, bring your own markup and styles, cookie consent solution. Perfect for agencies, enterprise teams and individuals who need full control over their cookie consent implementation and UX.

## Features

- No Markup/Styles: This library supplies no styles or markup allowing you to fully customise the look and feel of the cookie controller to match your website's design.
- Tiny Footprint: The library is only **~3.2KB** minified and gzipped.
- Attribute Driven: Hook up your markup using data attributes entirely.
- Consent Callbacks: Read the current preferences on load and after each saved decision.
- Consent Records: Use the generated UUID and the consent callback to record the users consent within your own system.
- Versioning: Ask for fresh consent when the cookie policy version changes.
- Storage Config: Confure the cookie used to store the users preferences.
- Accessibility: The library is fully accessible and as its attribute driven, you can easily customise the HTML to further meet your accessibility requirements.
- Destroy: Destroy the cookie controller instance and remove all event listeners. Useful for using within SPA's.

## Examples

- [Basic](https://github.com/ProtoDigitalUK/lucid_client/blob/master/packages/cookie-controller/examples/basic.html)
- [Tailwind](https://github.com/ProtoDigitalUK/lucid_client/blob/master/packages/cookie-controller/examples/tailwind.html)

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
  essentialCookies: true,
  categoryCookies: {
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
   * - onload: when the library is initialised
   */
  type: "accept" | "reject" | "save" | "onload";
  /**
   * The users UUID
   */
  uuid: string;
  /**
   * The version of the cookie policy
   */
  version?: string;
  /**
   * All of the cookie category states
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
  expires?: number | Date;
};

type Options = {
  /**
   * Set to true if you have essential cookies. This will return an extra category item called "essential" in the categories array on the onConsentChange callback
   */
  essentialCookies?: boolean;
  /**
   * A list of cookies that get added when a certain cateogry is consented
   * - Ie: analytics: ["_ga", "_gid"]
   *
   * Note that these are just returned in the onConsentChange callback, they are not added/removed from the users cookies
   */
  categoryCookies?: Record<string, Array<string>>;
  /**
   * Runs on load and after a decision is saved
   */
  onConsentChange?: ((data: ConsentChange) => void);
  /**
   * A callback that is fired whenever a user state has a different version of the cookie policy to the current version
   */
  version?: {
    /**
     * The current version of the cookie policy
     */
    current: string;
    /**
     * The callback
     */
    onNewVersion?: (oldVersion: string, newVersion: string) => void;
  };
  /**
   * Configure the options for the cookie used to store the user's preferences
   */
  storage?: StorageOptions;
};
```

### HTML Markup

On each page, include one `data-cookie-details` element and one `data-cookie-alert` element. With the `data-cookie-action` attributes, you can add as many as you like.

```html
<dialog data-cookie-details aria-label="Cookie settings" hidden>
  <button data-cookie-action="dismiss">Close</button>
  <button data-cookie-action="accept">Accept Recommended</button>
  <button data-cookie-action="reject">Reject</button>
  <a href="https://www.example.com/privacy-policy" target="_blank">
    Cookie Policy
  </a>
  <ul>
    <li>
      <p>Essential Cookies:</p>
      <p>...</p>
    </li>
    <li>
      <input id="analytics" type="checkbox" data-cookie-category="analytics" />
      <label for="analytics">Analytics:</label>
      <p>...</p>
    </li>
    <li>
      <input id="marketing" type="checkbox" data-cookie-category="marketing" />
      <label for="marketing">Marketing:</label>
      <p>...</p>
    </li>
  </ul>
  <button data-cookie-action="save">Save My Preferences</button>
</dialog>

<div data-cookie-alert hidden>
  <button data-cookie-action="accept">Accept All</button>
  <button data-cookie-action="reject">Reject</button>
  <button data-cookie-action="details">Details</button>
  <button data-cookie-action="dismiss">Close</button>
</div>

<button data-cookie-action="details">Open Cookie Modal</button>
```

> For a styled example, see `examples/tailwind.html`.

Use a native `<dialog>` for the preferences panel to get modal focus management and Escape-to-close. Checkbox edits take effect after Save. Closing preferences discards edits and returns visitors who have yet to decide to the banner.

Version 0.2.0 asks visitors who have a 0.1.0 preference cookie to choose again, since that format also saved unsaved checkbox edits.

## GDPR Compliance Tips

Our cookie controller is developed with GDPR considerations in mind. While this tool offers functionalities aligning with GDPR requirements, full compliance depends on how it is implemented within your website's broader context and architecture.

Here are some tips for achieving compliance:

- Cookie Policy Link: Include a link to your cookie or privacy policy.
- Define Cookie Controls: Clearly define what each checkbox controls, providing details like the name, duration, and purpose of the cookies.
- Necessary Cookies: Inform users about necessary cookies. These should not be connected to a `data-cookie-config` attribute, as they are for informational purposes only. In this case you may want to use the `essentialCookies` config option.
- Equal Prominence: Ensure 'Accept' and 'Reject' options are equally prominent in your design.
- Accessibility: Make sure the cookie controller is accessible to all users.
- Consent Recording: Save the consent data to ensure compliance with the consent recording requirements of GDPR.

Please note this is not an exhaustive list, and we recommend seeking legal advice to ensure full compliance.

## Missing Features

- Detailed documentation and examples via the [Lucid JS webiste](https://lucidjs.build/cookie-controller).
- Functions to update individual cookie category consent.
- The ability to refresh the library to register missing event handlers, etc.
- Make essential cookies required as the lib itself uses one.