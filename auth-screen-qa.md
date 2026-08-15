# Public Authentication Screen QA

- English public session: the first screen presents only the compact Sign In/Sign Up form and side Google sign-in option; marketing headings and feature cards are absent.
- Urdu public session: the language toggle switched the compact form, labels, Google option, and right-to-left direction correctly.
- The Google option is displayed as a clear side panel with a recognizable multicolor Google mark above the action button.
- The Sign Up tab exposes only username, Gmail/Email, password, password confirmation, and optional referral-code fields alongside the unchanged Google entry action.
- Automated workspace-gate coverage verifies that new Google users reach the combined setup before the dashboard, while existing password members and the designated administrator keep their established routes.
- Render-level coverage confirms the access gate displays combined Google setup instead of workspace for a passwordless Google account and preserves normal workspace rendering for existing password-based members and administrators.
