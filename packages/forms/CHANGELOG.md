# @lucidclient/forms

## v0.1.0 (unreleased)

### Features:

- Added Forms, a bring your own markup form library. Forms post and validate without JavaScript, and `init`, `refresh`, `destroy` and `get` enhance every `data-form` element with accessible inline errors and sending in place.
- Fields are checked with their native constraints, plus `data-form--maxlength`, `data-form--match`, `data-form--min-checked`, `data-form--max-checked`, file `accept`, `data-form--max-size`, `data-form--min-size`, `data-form--max-files` and custom rules named by `data-form--rule`.
- Messages come from `data-form--message-{check}` and `data-form--message` attributes, the `messages` option, or the browser's own. `data-form--message-{key}` on the form or an element around a field sets the messages of every field inside it, and of the status, counts and file lists, with plural forms picked by the element's language.
- Inline errors start with a visually hidden "Error:", from the `errorPrefix` message.
- Errors are linked to their fields with `aria-describedby` and `aria-invalid`, focus moves to a `data-form--summary` error summary or the first error, and `data-form--status` announces the form's messages. Errors already in the page are linked on load.
- Fields are checked on submit, or on change with `data-form--validate="change"`, and errors clear as soon as they are fixed.
- Forms send with `fetch` and read a JSON `message`, `redirect` and `errors`, showing server errors beside their fields, or submit natively with `data-form--submit="native"`. `data-form--sent`, `data-form--reset` and `data-form--redirect` choose what happens once a form is sent.
- Added `data-form--count` character counts, which announce once typing pauses.
- Added the `form-submit`, `form-success`, `form-error` and `form-invalid` events, `subscribe`, `setErrors`, `clearErrors`, and the `send` and `parse` options.
- Added the `files` extension from `@lucidclient/forms/files`, with drop zones, file lists and remove buttons.
- Forms ask `data-form--captcha` widgets for a token with a `captcha:token` event before sending, and the `turnstile` and `recaptcha` extensions from `@lucidclient/forms/turnstile` and `@lucidclient/forms/recaptcha` draw those widgets, loading them only when a form is used.
- Turnstile and reCAPTCHA follow the page's `lang` unless `data-language` is set.
- Warnings only log in the development build, which bundlers pick through the `development` export condition.
