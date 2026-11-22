# Cookie Controller

> Part of the Lucid Client suite

A lightweight, bring your own markup and styles, cookie consent solution. Perfect for agencies, enterprise teams and individuals who need full control over their cookie consent implementation and UX.

## Features

- No Markup/Styles: This library supplies no styles or markup allowing you to fully customise the look and feel of the cookie controller to match your website's design.
- Tiny Footprint: The library is only **~3.2KB** minified and gzipped.
- Attribute Driven: Hook up your markup using data attributes entirely.
- Consent Callbacks: Read the current preferences on load and after each saved decision.
- Category Consent: Grant or withdraw individual categories from anywhere on the page, such as an "Allow marketing cookies" button on an embed placeholder.
- Consent Records: Use the generated UUID and the consent callback to record the users consent within your own system.
- Versioning: Ask for fresh consent when the cookie policy version changes.
- Storage Config: Confure the cookie used to store the users preferences.
- Accessibility: The library is fully accessible and as its attribute driven, you can easily customise the HTML to further meet your accessibility requirements.
- Refresh: Pick up markup added or replaced after initialisation, such as after a client side navigation.
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
   * - update: when individual categories are updated via updateConsent or a category scoped accept/reject button
   * - onload: when the library is initialised
   */
  type: "accept" | "reject" | "save" | "update" | "onload";
  /**
   * The users UUID
   */
  uuid: string;
  /**
   * The version of the cookie policy
   */
  version?: string;
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
  categoryCookies?: Record<string, Array<string>>;
  /**
   * Runs on load and after a decision is saved
   */
  onConsentChange?: (data: ConsentChange) => void;
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

### Methods

| Method | Description |
| --- | --- |
| `init(options?)` | Initialises the library. Calling it again re-initialises it. |
| `refresh()` | Re-queries the markup and re-applies its attributes and visibility, without re-reading the cookie or firing callbacks. |
| `destroy()` | Removes all event listeners. |
| `getConsent(category)` | Returns whether a category is consented. `"essential"` is always `true`, and unknown categories return `undefined`. |
| `updateConsent(categories)` | Updates individual categories, for example `{ marketing: true }`. Other categories keep their saved value, or stay off if the visitor has not decided yet. Saves the decision, closes the alert and fires `onConsentChange` with the `update` type. |
| `acceptAll()` / `rejectAll()` | Accepts or rejects all categories, then closes the alert and details elements. |
| `saveDetails()` | Saves the checkbox choices in the details element, then closes it. |
| `openDetails()` | Opens the details element with its checkboxes set to the saved choices. |
| `closeDetails()` | Closes the details element without saving, discarding unsaved checkbox edits. |

Each method has a matching `data-cookie-action` value: `accept`, `reject`, `save`, `details` (which toggles the details element) and `dismiss`.

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

Use a native `<dialog>` for the details element to get modal focus management and Escape-to-close. Checkbox edits take effect after Save.

A `dismiss` action closes whichever element it is in:

- Inside the `data-cookie-alert` element, it hides the alert for the current page without saving a decision. No consent is given, and the alert shows again on the next page until the visitor chooses.
- Anywhere else, it closes the details element and discards unsaved checkbox edits. Visitors who have yet to decide return to the alert, unless they closed it on this page.

Version 1.0.0 asks visitors who have a 0.1.0 preference cookie to choose again, since that format also saved unsaved checkbox edits.

#### Category Buttons

Add a `data-cookie-category` attribute to an `accept` or `reject` action to update only that category. This works anywhere on the page, for example on an embed placeholder:

```html
<div class="video-placeholder">
  <p>This video needs marketing cookies.</p>
  <button data-cookie-action="accept" data-cookie-category="marketing">
    Allow marketing cookies
  </button>
</div>
```

The category needs a matching checkbox in the `data-cookie-details` element.

#### Essential Cookies

The `essential` category is always consented, and it always lists the `CookieController` cookie this library uses to store preferences. Add any other essential cookies with `categoryCookies.essential`. If you add a checkbox with `data-cookie-category="essential"`, it is shown checked and disabled.

#### Dynamic Markup

Action elements work as soon as they are added to the page. If the `data-cookie-details` or `data-cookie-alert` elements, or the category checkboxes, are added or replaced after `init`, such as after a client side navigation, call `refresh()`.

## GDPR Compliance Tips

Our cookie controller is developed with GDPR considerations in mind. While this tool offers functionalities aligning with GDPR requirements, full compliance depends on how it is implemented within your website's broader context and architecture.

Here are some tips for achieving compliance:

- Cookie Policy Link: Include a link to your cookie or privacy policy.
- Define Cookie Controls: Clearly define what each checkbox controls, providing details like the name, duration, and purpose of the cookies.
- Necessary Cookies: Inform users about necessary cookies. These are for informational purposes only, so do not give them a `data-cookie-category` checkbox they can toggle. The `essential` category is always consented, and a checkbox with `data-cookie-category="essential"` is shown checked and disabled.
- Equal Prominence: Ensure 'Accept' and 'Reject' options are equally prominent in your design.
- Accessibility: Make sure the cookie controller is accessible to all users.
- Consent Recording: Save the consent data to ensure compliance with the consent recording requirements of GDPR.

Please note this is not an exhaustive list, and we recommend seeking legal advice to ensure full compliance.
