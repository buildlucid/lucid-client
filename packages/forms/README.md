# Forms

> Part of the Lucid Client suite - documentation coming soon

Accessible forms for your own markup and styles. Forms are plain HTML that validate and post without JavaScript, and the library adds inline errors, an error summary, sending in place and more.

## Features

- Progressive Enhancement: Forms work without JavaScript, and get better with it.
- Attribute Driven: Set up forms with `data-form--*` attributes, with little or no JavaScript of your own.
- Accessible Errors: Inline errors linked to their fields, an error summary and focus that goes where it should.
- Sending in Place: Send with `fetch` and show the server's messages and errors.
- Character Counts: Show how many characters are left as people type.
- Files: Drop zones, file lists and file checks.
- Captcha: Support for Turnstile and reCAPTCHA.
- Translatable: Change any message the library writes.

## Installation

```bash
npm install @lucidclient/forms
```

## Usage

```typescript
import forms from "@lucidclient/forms";

forms.init();
```

```html
<form data-form="contact" action="/contact" method="post">
  <div data-form--status></div>

  <div data-form--field="email">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email" />
    <p data-form--error="email"></p>
  </div>

  <button>Send</button>
  <div data-form--sent>Thanks, we'll be in touch.</div>
</form>
```

```css
/* Hide the rest of the form once it's sent */
[data-form--state="success"]:has(> [data-form--sent]) > :not([data-form--sent]) {
  display: none;
}
```
