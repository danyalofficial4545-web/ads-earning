# Google OAuth Investigation

## 2026-08-27 production reproduction

On `https://ads-earning-kappa.vercel.app/?ref=danyal955163`, the visible **Continue with Google** control was clicked without entering any account data. Instead of launching the configured OAuth portal, the browser navigated to `https://omg10.com/4/10628127/?var=30918473`.

This indicates a third-party advertising script is intercepting the public authentication page click. The secure local OAuth launcher must remain unchanged; the targeted remediation is to prevent ad-script interaction with the public Sign In/Sign Up page and its authentication controls.

## 2026-08-27 updated local retest

After removing the advertising scripts from the public document shell and loading them only after authenticated workspace mount, clicking **Google کے ساتھ جاری رکھیں** navigated to the configured `https://manus.im/app-auth` URL. Its `redirectUri` correctly used the current preview origin plus `/api/oauth/callback`, and its one-time state/nonce was present. No advertising redirect occurred.
