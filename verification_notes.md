# Verification Notes

The signed-out landing page initially remained in a loading state because the unauthenticated session lookup was batched with platform data initialization. Public platform data is now requested only for authenticated sessions, allowing the explicit signed-out session response to resolve independently.

The English-to-Urdu language switch was checked interactively on the public page. It translated the visible landing content and applied a right-to-left layout with the Urdu-friendly typeface.

The replacement public authentication experience was visually checked in Urdu. The Sign In tab shows Gmail/Email and Password only, while the Sign Up tab shows Username, Gmail/Email, Password, Confirm Password, and optional Referral code fields without changing the established color system or page composition.

The custom registration form was exercised with mismatched passwords. It correctly rejected submission before account creation and displayed the translated Urdu error message.

The custom sign-in tab was checked separately and presents only Gmail/Email and Password fields, as required.

An invalid custom sign-in attempt was submitted using a non-existent email address. The request completed without creating or authenticating an account, preserving the public sign-in state.

The public custom Sign Up tab was reopened for a final isolated end-to-end registration and sign-in verification using a temporary test identity.

The temporary custom registration succeeded, displayed the translated success notice, and transitioned automatically into the authenticated workspace loading state using the new local credential session.

The temporary custom account reached the unchanged member dashboard, and logout correctly returned the browser to the custom public Sign In form.

The same temporary account then signed in successfully using only its registered Gmail/Email and Password. The translated success message appeared and the established member dashboard reopened normally.
