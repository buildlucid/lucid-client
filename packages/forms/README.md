# Forms

> Part of the Lucid Client suite

A bring your own markup and styles form library. Forms are plain HTML that post and validate without JavaScript, and the library enhances them with accessible inline errors, an error summary, sending in place, character counts, file drop zones and captcha support.

## Features

- Progressive Enhancement: Without JavaScript the browser checks and posts the form itself. With it, the same native constraints show accessible errors and the form sends with `fetch`.
- Attribute Driven: Options, messages and state are `data-form--*` attributes, so most forms need no JavaScript of their own.
- Accessible Errors: Errors are linked to their fields with `aria-describedby` and `aria-invalid`, focus moves to the error summary or the first error, and messages are announced through a live region. See [Accessibility](#accessibility).
- Error Summary: List every error with links to its field, as GOV.UK's error summary does.
- Kind Timing: No errors appear while someone is typing, and an error clears as soon as it is fixed.
- Responses: Reads a JSON `message`, `redirect` and `errors`, and shows server errors beside their fields.
- Character Count: Counts what is left as people type, and announces it once they pause.
- Files: Drop zones, file lists with remove buttons, and `accept`, size and count checks.
- Captcha: Turnstile and reCAPTCHA, loaded only when a form is used, or a widget of your own.
- Translatable: Every message can be set on the form, a field or in `init`, including plural forms. See [Messages](#messages).
- Development Warnings: Markup mistakes are pointed out while you develop, and left out of production builds.

## Getting Started

### Installation

```bash
npm install @lucidclient/forms
```

### Usage

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

The form's constraints are the HTML ones: `required`, `type`, `pattern`, `minlength`, `maxlength`, `min`, `max`, `step` and `accept`. The library adds `novalidate` and shows the browser's messages in your error elements instead of its bubbles.

### CSS

The library brings no CSS. This hides the rest of a form once its sent message shows:

```css
[data-form--state="success"]:has(> [data-form--sent]) > :not([data-form--sent]) {
  display: none;
}
```

## Markup

### Elements

| Attribute | Description |
| --- | --- |
| `data-form` | The `<form>`. Its value is an optional name for `forms.get`. |
| `data-form--field="name"` | A field's wrapper. Gets `data-form--invalid` while the field has an error. Use a `<fieldset>` for groups of radios and checkboxes. |
| `data-form--error="name"` | Where a field's errors are written. Hidden while empty. A `<ul>` or `<ol>` gets one `<li>` per message. |
| `data-form--status` | A live region for the form's messages, such as sending, sent or a server error. Gets `role="status"` unless it has a role. |
| `data-form--summary` | An error summary. Its `<template>` is cloned for each error. See [Error summary](#error-summary). |
| `data-form--sent` | Shown and focused once the form is sent. Hidden until then. When empty, it shows the server's message. |
| `data-form--count="name"` | A character count. See [Character count](#character-count). |
| `data-form--captcha` | A captcha widget. See [Captcha](#captcha). |
| `data-form--honeypot` | A spam trap, kept out of the tab order, away from screen readers and out of validation. |

Field names match without a trailing `[]` or index, so `topics[]` and `files.0` belong to `topics` and `files`. A control without a name, such as an "I agree" checkbox, is checked as a field named by its id. Elements must be inside the form, though controls outside it with a `form` attribute work.

### Options

Options are attributes on the form, read each time they are used.

| Attribute | Description |
| --- | --- |
| `data-form--validate` | When fields are checked: `submit` (the default), `change` to also check a field when it changes, or `off` to leave checking to the server. |
| `data-form--submit` | `fetch` sends the form in place, and `native` checks it and then lets the browser submit. POST forms default to `fetch` and GET forms to `native`. |
| `data-form--reset="false"` | Keeps the values after the form is sent. |
| `data-form--redirect` | A page to go to once the form is sent. |

A submit button with `formnovalidate` sends without checking, such as for "Save draft", and `formaction`, `formmethod` and the button's own `name` and `value` are sent as the browser would. A `submit` listener of your own that calls `preventDefault()` takes the form over, and the library leaves that submission alone.

### Constraints

These go on a control, apart from the checked counts, which go on a group's `data-form--field` wrapper:

| Attribute | Description |
| --- | --- |
| `data-form--maxlength` | A character limit that can be typed past, with an error. Native `maxlength` stops typing instead. |
| `data-form--match="name"` | Must be the same as another field, such as a confirmed password. |
| `data-form--rule="name"` | Runs a custom rule from `init`. Several are separated by spaces. |
| `data-form--max-size`, `data-form--min-size` | File sizes, such as `5MB`, `500KB` or a number of bytes. |
| `data-form--max-files` | The most files a file input takes. |
| `data-form--min-checked`, `data-form--max-checked` | On a group's wrapper, how many checkboxes must be ticked. |

`accept` is checked too, as browsers only use it to filter the file picker. Value checks skip empty fields, so pair them with `required` when a value is needed. A custom validity your own script sets with `setCustomValidity()` is shown like any other error.

Each check's message can be set in the markup. See [Messages](#messages).

### State

| On | Attribute | Description |
| --- | --- | --- |
| Form | `data-form--ready` | Added once the form is enhanced. |
| Form | `data-form--state` | `idle`, `submitting`, `success` or `error`. |
| Form | `data-form--invalid` | Present while any field has an error. |
| Field wrapper | `data-form--invalid` | Present while the field has an error. |
| Control | `aria-invalid="true"` | While its field has an error. |
| Submit button | `aria-disabled="true"` | While sending, so it keeps focus. Presses are ignored. |
| Count | `data-form--over` | Present while over the limit. |

### Error summary

```html
<div data-form--summary>
  <h2>There is a problem</h2>
  <ul>
    <template><li><a href="#{id}">{message}</a></li></template>
  </ul>
</div>
```

The template is cloned once per error, with `{message}`, `{id}` (the field's first control), `{name}` and `{label}`. When a form fails its checks, focus moves to the summary, and its links move focus to their field. Without a summary, focus moves to the first field with an error, and the status says how many answers need fixing, updating as they are fixed. Whatever takes focus is scrolled to the middle of the view when it isn't already in view, smoothly unless the visitor prefers reduced motion.

### Timing

Fields are checked when the form is submitted. A field that shows an error is checked again as it changes, so the error clears as soon as it is fixed, but no new errors appear while someone is typing. Errors the server rendered into the page, such as after a submission without JavaScript, are linked to their fields on load.

### Character count

```html
<label for="message">Message</label>
<textarea id="message" name="message" data-form--maxlength="500"></textarea>
<p data-form--count="message">You can enter up to 500 characters</p>
<p data-form--error="message"></p>
```

The count's text becomes `You have 20 characters remaining`, or `You have 3 characters too many`, and describes the field, so it is read when the field is focused. While typing, it is announced once typing pauses, rather than on every key. The field's `maxlength` or `data-form--maxlength` is the limit.

## Accessibility

The library follows GOV.UK's [error summary](https://design-system.service.gov.uk/components/error-summary/), [error message](https://design-system.service.gov.uk/components/error-message/) and [character count](https://design-system.service.gov.uk/components/character-count/) patterns. Anything you set yourself is kept, and `destroy` removes what the library added.

- The form gets `novalidate`, and fields are checked when it is submitted rather than as people type.
- Errors are written into each field's `data-form--error` element after a visually hidden "Error:", and linked to the field with `aria-describedby`. Controls get `aria-invalid="true"` while they have an error, and a `<fieldset>` wrapper is described rather than each radio or checkbox.
- Focus moves to the error summary, or else to the first field with an error. Summary links focus their field and bring its label, or a group's legend, into view with it.
- `data-form--status` elements are live regions from the start, so sending, sent and failed messages are announced. Without a summary, the status says how many answers need fixing.
- Submit buttons get `aria-disabled="true"` while sending rather than `disabled`, so the one that was pressed keeps focus. The `data-form--sent` element takes focus once the form is sent.
- Character counts describe their field and are announced once typing pauses.
- Remove buttons are named after their file, focus moves to the next file once one is removed, and dropped and removed files are announced.
- Honeypots are kept out of the tab order and away from screen readers.

Your markup still needs to:

- Give every control a `<label>`, and group radios and checkboxes in a `<fieldset>` with a `<legend>`.
- Add `autocomplete` to fields about the visitor, such as `autocomplete="email"` (WCAG 1.3.5).
- Put the error summary at the top of the form, with a heading such as "There is a problem".
- Keep the file input reachable, or show its focus on the drop zone with `:focus-within`.
- Start a translated remove button's label with its visible text, such as `Supprimer {file}` for a "Supprimer" button (WCAG 2.5.3).

On a sign in form, a captcha that asks people to solve a puzzle or type characters fails WCAG 3.3.8. Turnstile and reCAPTCHA's invisible and score checks ask nothing of most visitors.

The [development build](#development-build) warns about markup it can't work with, such as a field without an error element, a count without a limit or a form without a status.

## Messages

Every message the library writes can be translated or reworded, in the markup or with `messages` in `init`. Attributes win over `init`, so a form, or a section of one, can have its own.

### Field errors

A failed check's message comes from the first of:

1. `data-form--message-{check}` on the control, then on its wrapper, such as `data-form--message-required="Enter your email address"`.
2. `data-form--message` on the control, then on its wrapper, for any check.
3. `data-form--message-{check}` on an element around the field, or on the form, for every field inside it.
4. The message a rule returned.
5. `messages` passed to `init`.
6. The browser's own message.

Checks are `required`, `type`, `pattern`, `minlength`, `maxlength`, `min`, `max`, `step`, `accept`, `max-size`, `min-size`, `max-files`, `min-checked`, `max-checked`, `match` and a rule's name. Messages can use `{label}`, the field's label, and `{limit}`, the value of the check, such as `{limit}` characters. File messages also have `{file}`.

The browser's own messages are in the browser's language, which may not be the page's. On a site in more than one language, set a message for each check you use, such as on the form or in `init`. The development build warns when a browser message shows on a page whose `lang` differs from the browser's.

### The library's own messages

These come from `data-form--message-{key}` on the element that shows them or an element around it, such as the count, the field wrapper or the form, then `messages` passed to `init`, then the default. Keys are kebab case in attributes, such as `data-form--message-error-prefix`.

```html
<form
  data-form
  lang="fr"
  data-form--message-required="Saisissez {label}"
  data-form--message-error-prefix="Erreur :"
  data-form--message-submitting="Envoi…"
  data-form--message-success="Merci, votre formulaire a été envoyé."
  data-form--message-error="Votre formulaire n'a pas pu être envoyé. Réessayez."
>
```

| Message | Default | Used for |
| --- | --- | --- |
| `errorPrefix` | `Error:` | Read before each inline error, from a visually hidden span. `""` leaves it out. |
| `invalid` | `There are problems with {count} answers. Check the form and try again.` | The status after checks fail, without an error summary. |
| `submitting` | `Sending…` | The status while sending. |
| `success` | `Thank you, your form has been sent.` | The status once sent, when the response has no message. |
| `error` | `Your form couldn't be sent. Try again.` | The status after a failed send, when the response has no message. |
| `remaining`, `over` | `You have {count} characters remaining`, `You have {count} characters too many` | Character counts. |
| `remove` | `Remove {file}` | Remove buttons without a label. |
| `added`, `removed` | `Added {file}` or `Added {count} files`, `Removed {file}` | Announced when files are dropped or removed. |
| `accept`, `maxSize`, `minSize`, `maxFiles`, `minChecked`, `maxChecked`, `match`, `rule` | Such as `{file} must be smaller than {limit}` | Field errors without a browser message. |

### Plurals

In `init`, a message can be a function, such as `remaining: ({ count }) => …`. In the markup, a message can have plural forms with a suffix for each plural category of the element's `lang`: `zero`, `one`, `two`, `few`, `many` or `other`. They are picked by `{count}`, or by `{limit}` for a check, and the attribute without a suffix covers any form not given. Empty attributes are ignored.

```html
<p
  data-form--count="message"
  data-form--message-remaining="Pozostało {count} znaków"
  data-form--message-remaining-few="Pozostały {count} znaki"
  data-form--message-remaining-one="Pozostał {count} znak"
></p>
```

## Sending

Forms are sent with `fetch` to their `action`, with `Accept: application/json`. POST forms send multipart data when they hold files or ask for it with `enctype`, and URL encoded data otherwise. Empty file inputs are left out.

The default parser reads:

- Success: any 2xx response, including an empty one. A `message` is shown, and a `redirect` is followed.
- Errors: `{ errors: { email: "Enter your email" } }`, with a message or a list of them per field, or `{ errors: [{ name, message }] }`, with `field` or `path` in place of `name`. Errors for names with no field are shown in the status. A response with errors, or with `success: false`, is refused even with a 2xx status.

```json
{ "message": "Thanks, we'll be in touch.", "redirect": "/thank-you" }
```

```json
{ "message": "Some answers need checking.", "errors": { "email": ["That email is already registered."] } }
```

For any other shape, pass a `parse` function in the options.

Anything else shows the `error` message. Once sent, the form is reset and its `data-form--sent` element shows, or else the message is written to the status.

## Files

```typescript
import forms from "@lucidclient/forms";
import { files } from "@lucidclient/forms/files";

forms.init({ extensions: [files] });
```

```html
<div data-form--field="documents">
  <div data-form--dropzone>
    <label for="documents">Documents</label>
    <input id="documents" type="file" name="documents" multiple accept=".pdf,image/*" data-form--max-size="5MB" />
    <p>or drop files here</p>
  </div>
  <ul data-form--files="documents">
    <template><li>{name} ({size}) <button data-form--remove>Remove</button></li></template>
  </ul>
  <p data-form--error="documents"></p>
</div>
```

- `data-form--dropzone` adds drag and drop to the file input inside it. The input stays the control people focus and use with a keyboard, and a press on an empty part of the zone opens the picker. The zone gets `data-form--dragging` while files are dragged over it and `data-form--has-files` while it has some.
- `data-form--files` lists a field's files from its `<template>`, with `{name}`, `{size}`, `{type}` and `{index}`. Remove buttons get `type="button"` and an `aria-label` such as `Remove cv.pdf`, and focus moves to the next file once one is removed.
- A `multiple` input with a file list keeps its files across picks and drops. Dropped and removed files are announced.

## Captcha

The form asks each `data-form--captcha` element for a token before sending, and waits up to 30 seconds for it, then checks the fields again in case they changed meanwhile. The element gets a `captcha:token` event whose `detail` takes a promise to wait on, and a `captcha:reset` event after each send, as tokens only work once, so a widget of your own can work with any form.

For Turnstile or reCAPTCHA, add the provider's extension and an element with your site key. The provider's script loads once, when a form comes near the viewport or is first used.

```typescript
import { recaptcha } from "@lucidclient/forms/recaptcha";
import { turnstile } from "@lucidclient/forms/turnstile";

forms.init({ extensions: [turnstile, recaptcha] });
```

```html
<div data-form--captcha="turnstile" data-sitekey="…" data-action="contact"></div>
<div data-form--captcha="recaptcha" data-sitekey="…"></div>
```

- Turnstile takes its own `data-action`, `data-cdata`, `data-theme`, `data-size`, `data-appearance` and `data-language`, and sends `cf-turnstile-response`.
- Both follow the page's `lang` unless `data-language` sets their language. reCAPTCHA's script loads once, so the first widget on the page sets it.
- reCAPTCHA shows the checkbox, and a send waits until it is ticked. `data-size="invisible"` runs an invisible check when the form is sent, `data-score` gets a v3 score token with `data-action` on every send, and `data-enterprise` uses reCAPTCHA Enterprise. It sends `g-recaptcha-response`.
- `data-response-field-name` sends the token under another name, such as `captcha`.

Verify the token on your server. A widget that fails sends no token, and the server's error is shown.

## API

```typescript
import forms from "@lucidclient/forms";

forms.init({
  messages: { required: "Enter {label}" },
  rules: {
    postcode: (value) => /^[A-Z]{1,2}\d/i.test(value) || "Enter a real postcode",
  },
});

const contact = forms.get("contact");
contact?.setErrors({ email: "That email is already registered" });

document.addEventListener("form-success", (event) => {
  console.log(event.detail.result);
});
```

### Methods

| Method | Description |
| --- | --- |
| `init(options?)` | Enhances every `data-form` element. Calling it again destroys every form and enhances the page again. Before the document has loaded, it waits for `DOMContentLoaded`. |
| `refresh()` | Destroys forms that left the page, reads the markup of the others again and enhances new ones. |
| `destroy()` | Destroys every form, removing its listeners and everything the library added. |
| `get(target)` | Returns the form for an element inside it, or for its id or `data-form` name. |

Fields added to a form work straight away. Call `refresh()` after adding counts, summaries, file lists or captcha widgets.

`get` returns a `Form`:

| Member | Description |
| --- | --- |
| `element` | The form. |
| `state` | A copy of `{ status, errors, message, dirty }`. |
| `submit()` | Checks and sends the form. Resolves with the result, or `null` when nothing was sent. |
| `validate(name?)` | Checks every field, or one, and shows the errors. Returns whether they passed. |
| `reset()` | Resets the form, clearing its errors and sent message. |
| `setErrors(errors, { focus })` | Shows errors by field name, such as from your own checks. |
| `clearErrors(name?)` | Clears every field's errors, or one's. |
| `subscribe(listener)` | Runs the listener after every state change, and returns a function that removes it. |
| `refresh()`, `destroy()` | Refresh or destroy this form. |

### Events

Events bubble from the form.

| Event | Detail |
| --- | --- |
| `form-submit` | `{ data, submitter }`, before sending. Change `data`, or call `preventDefault()` to stop the send. |
| `form-success` | `{ result, response }`, once the form is sent. |
| `form-error` | `{ result, response, error }`, when the server refused it or the request failed. |
| `form-invalid` | `{ errors }`, when the form failed its checks. |

### Options

| Option | Description |
| --- | --- |
| `messages` | Text the library writes. Each is a template or a function, such as `remaining: ({ count }) => …` for plurals. Native checks use the browser's message unless set. See [Messages](#messages). |
| `rules` | Custom checks for `data-form--rule`. A rule gets the value and `{ control, controls, form }`, and returns a message or `false` to fail. |
| `extensions` | Extensions such as `files`, `turnstile` and `recaptcha`. |
| `send(request, form)` | Sends the request instead of `fetch`. Return the `Response`, or a result such as `{ ok: false, errors }`. |
| `parse(response, form)` | Reads a response instead of the default parser. Returns `{ ok, message?, errors?, redirect? }`. |

### Development Build

The library warns about markup it can't work with, such as a field without an error element, a character count without a limit, a rule that wasn't passed to `init`, or a browser message in a language other than the page's. Warnings only log in the development build, which bundlers such as Vite and webpack pick through the `development` export condition while you develop. Production builds leave them out.
