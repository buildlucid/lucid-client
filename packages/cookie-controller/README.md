# Cookie Controller

> Part of the Lucid Client suite - documentation coming soon

Cookie consent for your own markup and styles. Show a banner and a settings dialog, hold back scripts and embeds until visitors consent, and keep full control over how it looks.

## Features

- Attribute Driven: Set up the banner, settings and buttons with `data-cookie--*` attributes.
- Category Consent: Let visitors choose each category, from the settings or anywhere on the page.
- Scripts and Media: Hold back scripts, iframes, images and video until their category is consented.
- Google Tag Manager: Drive Google consent mode from the visitor's choices.
- Consent Records: Record each visitor's choices in your own system.
- Policy Versions: Ask visitors again when your cookie policy changes.
- Accessible: Follows GOV.UK's cookie banner pattern.
- Translatable: Change any message the library writes.

## Installation

```bash
npm install @lucidclient/cookie-controller
```

## Usage

```typescript
import cookieController from "@lucidclient/cookie-controller";

cookieController.init({
  cookies: {
    analytics: ["_ga", "_gid"],
    marketing: ["mkto"],
  },
  onConsentChange: (data) => {
    console.log(data);
  },
});
```

```html
<div data-cookie--banner aria-label="Cookies on Example" hidden>
  <p>We use cookies to improve our site.</p>
  <button data-cookie--action="accept">Accept all</button>
  <button data-cookie--action="reject">Reject all</button>
  <button data-cookie--action="details">Cookie settings</button>
</div>

<dialog data-cookie--details aria-label="Cookie settings" hidden>
  <label>
    <input type="checkbox" data-cookie--category="analytics" />
    Analytics
  </label>
  <label>
    <input type="checkbox" data-cookie--category="marketing" />
    Marketing
  </label>
  <button data-cookie--action="save">Save preferences</button>
  <button data-cookie--action="dismiss">Close</button>
</dialog>

<p data-cookie--status></p>

<script type="text/plain" data-cookie--category="analytics" src="/analytics.js"></script>
```

The analytics script only runs once the visitor accepts analytics cookies.

## GDPR

The library is built with GDPR in mind, but compliance depends on how you use it. Link to your cookie policy, explain what each category does, make accepting and rejecting equally easy, and keep a record of each visitor's consent. This isn't legal advice, so check with a legal professional.
