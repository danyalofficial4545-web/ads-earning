# Vercel production environment variables

When importing this repository into Vercel, open **Project Settings → Environment Variables** and add each required variable for the **Production** environment before redeploying. Do not place any secret in client-side source code or commit it to Git.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | The existing MySQL/TiDB connection string used by all member, admin, payment, ad, and ticket records. |
| `JWT_SECRET` | Yes | Signs the custom member session cookie. Use the existing project value. |
| `OAUTH_SERVER_URL` | Yes | Supports the configured OAuth flow. |
| `VITE_APP_ID` | Yes | Application identifier used by the existing OAuth configuration during the Vite build. |
| `BUILT_IN_FORGE_API_URL` | Yes | Server-side Manus Forge endpoint used by existing storage integrations. |
| `BUILT_IN_FORGE_API_KEY` | Yes | Server-side key for the Manus Forge endpoint. |
| `BOT_TOKEN` | Yes | Telegram bot token for deposit, withdrawal, and support alerts. |
| `CHAT_ID` | Yes | Telegram recipient chat identifier for those alerts. |
| `OWNER_OPEN_ID` | Recommended | Preserves the existing project-owner behavior where applicable. |

> Use the existing production values from the current Manus project configuration. The client must never receive `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`, `BOT_TOKEN`, or `CHAT_ID`.

After saving the values, use **Deployments → Redeploy** in Vercel. The deployment can then be verified by opening `/api/trpc/platform.publicData` through the site; a successful response is JSON rather than a `Database unavailable` error.
