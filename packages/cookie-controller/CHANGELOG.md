# @lucidclient/cookie-controller

## v1.2.0

### Breaking Changes:

- Attributes follow the suite's `data-{namespace}--{specifier}` grammar. `data-cookie-action`, `data-cookie-category`, `data-cookie-details`, `data-cookie-alert` and `data-cookie-activated` are now `data-cookie--action`, `data-cookie--category`, `data-cookie--details`, `data-cookie--banner` and `data-cookie--activated`, so Tailwind variants such as `data-[cookie-alert=true]:` become `data-[cookie--banner=true]:`. The banner's default id is now `cookie-banner` rather than `cookie-alert`.
- Gated media uses `data-cookie--src` and `data-cookie--srcset` instead of `data-src` and `data-srcset`, and gated scripts use `data-cookie--type` instead of `data-type`, so they no longer clash with lazy loading libraries that read `data-src`.
- The banner gets `role="region"` and a name instead of `role="alert"` and `aria-live="polite"`, so screen readers no longer read the whole banner out when it appears. A role or name the markup sets is kept.
- The details element only gets `role="dialog"` when it isn't a `<dialog>`, and never gets `aria-modal`. Use a `<dialog>` for a modal, which the library opens with `showModal()`.
- The banner and details elements no longer get `aria-hidden`, as `hidden` already hides them, and `details` actions no longer get `aria-expanded` or `aria-haspopup`.
- Warnings only log in the development build, which bundlers pick through the `development` export condition.

### Features:

- Added `data-cookie--status` elements, which say what was chosen after each decision and take focus when a decision hides the element that had it.
- Added `messages` for translating the text the library writes, such as `messages.banner` for the banner's name, and `data-cookie--message-{name}` attributes for a status element's own.
- A banner or details element without a name gets one, a details element that isn't a `<dialog>` takes focus when it opens and closes with Escape, and `destroy` removes the attributes the library added.
- The development build warns about a details element that isn't a `<dialog>` and a category checkbox without a label.

### Bug Fixes:

- Closing the details element opened from the banner gives focus back to the banner's button, rather than losing it while the banner is hidden.

## v1.1.0

### Features:

- The preference cookie now lasts 180 days by default, instead of ending when the browser closes. Pass `storage: { expires: 0 }` to keep a session cookie.

### Breaking Changes:

- Renamed the `categoryCookies` option to `cookies`. It takes the same `{ category: ["cookie"] }` shape.
- Replaced the `version: { current, onNewVersion }` option with top level `policyVersion` and `onPolicyVersionChange` options.
- Renamed `version` to `policyVersion` in the `onConsentChange` data and the `getConsent` options.
- Renamed the `onload` consent change type to `load`. Saved preference cookies are unchanged, so visitors are not asked again.

## v1.0.0

### Features:

- Added `updateConsent` to grant or withdraw individual categories, and support for category scoped `accept`/`reject` actions via `data-cookie-category`. These fire `onConsentChange` with a new `update` type.
- Added `refresh` to pick up markup added or replaced after initialisation without re-firing callbacks.
- Action elements added after initialisation now work without a refresh.
- A checkbox with `data-cookie-category="essential"` is shown checked and disabled.
- Scripts with `type="text/plain"` and a `data-cookie-category` attribute run once their category is consented. Iframes, images, video and audio load their `data-src` and `data-srcset` the same way.
- The `data-cookie-alert` element is now optional, so a site can show its own banner from `onConsentChange`.
- `getConsent()` with no argument returns the consent for every category, and `getConsent` now works before `init` by reading the saved cookie, with an optional policy `version` check.

### Breaking Changes:

- Renamed `getCookieConsent` to `getConsent`, `accept` to `acceptAll`, `reject` to `rejectAll` and `save` to `saveDetails`.
- Replaced `toggleDetails` and `dismiss` with `openDetails` and `closeDetails`. The `details` and `dismiss` actions are unchanged.
- Removed the `essentialCookies` option. The `essential` category is now always included in `onConsentChange` and always lists the library's own `CookieController` cookie.

### Bug Fixes:

- Save only explicit consent decisions, request fresh consent when the policy changes, and keep optional cookies off until the visitor chooses.
- A `dismiss` action inside the alert now hides the alert for the current page without saving a decision.
