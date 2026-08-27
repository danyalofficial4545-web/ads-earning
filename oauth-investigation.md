# Google OAuth Investigation

## 2026-08-27 production reproduction

On `https://ads-earning-kappa.vercel.app/?ref=danyal955163`, the visible **Continue with Google** control was clicked without entering any account data. Instead of launching the configured OAuth portal, the browser navigated to `https://omg10.com/4/10628127/?var=30918473`.

This indicates a third-party advertising script is intercepting the public authentication page click. The secure local OAuth launcher must remain unchanged; the targeted remediation is to prevent ad-script interaction with the public Sign In/Sign Up page and its authentication controls.

## 2026-08-27 updated local retest

After removing the advertising scripts from the public document shell and loading them only after authenticated workspace mount, clicking **Google کے ساتھ جاری رکھیں** navigated to the configured `https://manus.im/app-auth` URL. Its `redirectUri` correctly used the current preview origin plus `/api/oauth/callback`, and its one-time state/nonce was present. No advertising redirect occurred.

## 2026-08-27 production retest after deployment

The exact Vercel production page showed the public sign-in UI without redirecting to the prior ad-network domain. However, clicking **Continue with Google** did not navigate away from the Vercel page. This confirms the ad redirect is removed but the production OAuth click requires additional diagnosis of browser-side click handling and console errors before final delivery.

## 2026-08-27 production click diagnostics

The production Google button was found, enabled, type `button`, and had `pointer-events: auto`. Browser console had no emitted error. A native DOM `button.click()` also left the page unchanged. The next diagnostic is to compare the served production JavaScript runtime with the committed OAuth launcher and check whether an external interaction handler still prevents navigation.

## 2026-08-27 production bundle root cause

The production bundle contains the OAuth launcher with `new URL("undefined/app-auth")`, proving `VITE_OAUTH_PORTAL_URL` was not supplied to the Vercel build. That malformed relative target routes back through the website SPA instead of opening the Manus OAuth portal. The application needs a safe `https://manus.im` default portal fallback in the client launcher, while retaining the required origin-specific callback and nonce/state validation.

## 2026-08-27 final production verification

The deployed Vercel production Google button now opens `https://manus.im/app-auth` and carries `https://ads-earning-kappa.vercel.app/api/oauth/callback` as its redirect URI, plus a fresh nonce in the encoded OAuth state. The public login page no longer sends Google users to the advertising redirect or the old `undefined/app-auth` in-app route.

## 2026-08-27 provider allowlist diagnosis

The reported `invalid redirect_uri` response occurs after the browser reaches the OAuth provider and confirms that the deployed client is requesting the intended callback: `https://ads-earning-kappa.vercel.app/api/oauth/callback`. The app-owned callback route validates its one-time nonce/state and exchanges the authorization code through the configured Manus OAuth application (`2eS9vxiE6sqzgpWYMX6qhd`); it does not contain Firebase or Supabase authentication handlers.

Task connector/project configuration was inspected for an OAuth or Google provider control and no such configurable integration was available. Therefore, the remaining correction is an OAuth provider/application allowlist update that permits the exact Vercel callback URL for this application. It cannot be safely solved by adding Firebase/Supabase callback paths, bypassing state/nonce validation, or implementing direct Google OAuth without a user-owned Google OAuth client, secret, authorized origins, server callback handling, and an explicit infrastructure migration approval.
