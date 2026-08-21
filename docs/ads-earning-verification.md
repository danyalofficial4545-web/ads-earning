# Ads Earning rename verification

The Ads Earning rename was validated with automated tests, type-checking, the standard production build, and the Vercel-specific build. The persisted `appSettings.websiteName` value is now `Ads Earning`, and the default for future app-settings records has been migrated to the same value.

Two local mobile preview captures remained on the existing initial **Loading your workspace…** screen. Runtime logs show that the preview browser is authenticated as an already restricted account, whose protected bootstrap, overview, and wallet requests correctly return `FORBIDDEN`. This access-state behavior was not introduced by the branding changes.
