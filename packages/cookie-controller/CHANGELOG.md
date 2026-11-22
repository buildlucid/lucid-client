# @lucidclient/cookie-controller

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
