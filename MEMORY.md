# Euro Games Memory

- The existing workspace is page-state-driven in `client/src/pages/Home.tsx`; `/euro` will use that same authenticated shell rather than creating a separate project or domain.
- Main wallet values are held in `profiles.balancePkr`. Existing overview masking intentionally hides those values for non-package members, so Euro data needs its own protected endpoint and must never rely on the masked overview response.
- Existing financial transactions cannot represent Euro game activity cleanly; dedicated Euro ledger tables are required to preserve withdrawal and referral behavior.
- The existing database uses Drizzle/MySQL and migrations must be generated then applied through the database migration workflow.
- The user requested implementation of Aviator first. The other nine games remain out of this first implementation while their intended cards/settings can be planned for a later phase.
- The unauthenticated `/euro` desktop and mobile previews both retained the existing protected workspace loading shell without a blank-screen or route-rendering failure. An authenticated visual pass remains required to inspect the Euro dashboard controls themselves.
