# AI Support smoke-check findings

- The initial direct `/support` screenshot returned the existing 404 page because App.tsx had no `/support` route.
- Added an explicit `/support` route to the existing Home shell; Home already maps `/support` to the support page.
- The `/admin/support` screenshot reached the existing authenticated workspace loading shell, so its route pattern is recognized.
- Floating Help and WhatsApp controls are rendered inside the authenticated workspace shell.
