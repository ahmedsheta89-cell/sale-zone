# Sale Zone Auth Setup

This project now supports three customer sign-in paths in the store:

- Magic Link (passwordless)
- Google Sign-In
- Email/password

## Required Firebase Console Actions

Complete these steps before expecting Magic Link and Google Sign-In to work in production.

### 1. Enable Email Link Sign-In

Firebase Console -> Authentication -> Sign-in method -> Email/Password

- Enable `Email/Password`
- Enable `Email link (passwordless sign-in)`

### 2. Enable Google Sign-In

Firebase Console -> Authentication -> Sign-in method -> Google

- Enable `Google`
- Set a valid support email

### 3. Authorize the GitHub Pages Domain

Firebase Console -> Authentication -> Settings -> Authorized domains

Add:

- `ahmedsheta89-cell.github.io`

## Redirect URL Used By Magic Link

The store completes passwordless sign-in on this URL:

- `https://ahmedsheta89-cell.github.io/sale-zone/متجر_2.HTML`

## How Magic Link Works

1. Customer opens the auth modal.
2. Customer chooses `دخول برابط`.
3. Customer enters email and submits.
4. Firebase sends a sign-in link to the email.
5. Customer clicks the link and returns to the store.
6. The store detects the link and completes sign-in automatically.

## Google Sign-In Notes

- Google Sign-In uses Firebase Auth popup flow.
- If the popup opens and closes immediately, re-check:
  - Google provider enabled
  - support email configured
  - authorized domain added correctly

## Troubleshooting

### Magic Link not sent

- Confirm Email Link is enabled in Firebase Console
- Confirm the authorized domain is present
- Check browser console for Firebase Auth errors

### Google Sign-In popup blocked

- Allow popups for the site
- Retry after confirming Google provider is enabled

### Redirect returns but sign-in does not complete

- Ensure the exact redirect URL above is used
- Ensure the same email address is available in local storage or entered when prompted
