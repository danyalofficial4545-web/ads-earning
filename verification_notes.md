# Verification Notes

The signed-out landing page initially remained in a loading state because the unauthenticated session lookup was batched with platform data initialization. Public platform data is now requested only for authenticated sessions, allowing the explicit signed-out session response to resolve independently.

The English-to-Urdu language switch was checked interactively on the public page. It translated the visible landing content and applied a right-to-left layout with the Urdu-friendly typeface.
