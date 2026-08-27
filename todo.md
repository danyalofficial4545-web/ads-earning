# Project TODO

- [x] Establish Package Earn Pro’s responsive deep-green, gold, and slate visual system with English/Urdu typography and RTL language direction.
- [x] Define and migrate persistent database tables for profiles, packages, package ownership, transactions, deposits, withdrawals, ad sessions, referrals, payment accounts, ads, tickets, broadcasts, and global settings.
- [x] Enforce server-side designated-admin access for username `danyal955163` and email `muhammaddanyal4545@gmail.com`, including blocked-user checks.
- [x] Implement server-side package purchase, expiry evaluation, wallet balance updates, fixed/configurable PKR–USD conversion, and referral withdrawal-limit crediting.
- [x] Implement server-side ad sessions with a configurable minimum duration, daily allocation logic, and reward validation that cannot be bypassed in the browser.
- [x] Implement the customer dashboard, packages, wallet, deposit, withdrawal, ad earning, transaction history, referral, and support pages with functional mutations and feedback states.
- [x] Implement an accessible desktop top navigation, responsive mobile bottom navigation, account controls, and complete English/Urdu translations.
- [x] Implement deposit proof uploads to secure storage, deposit status tracking, and administrative approval/rejection actions.
- [x] Implement withdrawal limits, validation, request tracking, and administrative approval/rejection actions using the specified exact withdrawal-lock message.
- [x] Implement the secure administrator panel for approvals, ads, payment account settings, broadcasts, user monitoring/blocking, global settings, and ticket responses.
- [x] Add automated unit tests for critical server-side financial, privilege, referral, and ad-timer rules.
- [x] Verify build, type-checking, primary click paths, error paths, desktop/mobile screenshots, and fix discovered issues.
- [x] Link deposit and withdrawal transaction rows to their specific request IDs and update only the matching transaction during administrative review.
- [x] Require a server-verifiable active ad-session heartbeat so leaving an ad early invalidates its reward claim.
- [x] Complete English/Urdu coverage for all remaining administration, dynamic, and customer-facing interface strings.
- [x] Add automated tests for designated-admin route protection, blocked-user rejection, and request-specific financial review flows.
- [x] Exercise authenticated member and administrator primary flows plus key error paths in the browser where the authorized identities are available.
- [x] Replace all remaining hardcoded English customer/admin UI strings and dynamic status labels with bilingual translations.
- [x] Add router-level tests for admin-only access, blocked-user rejection, and request-specific deposit/withdrawal review mutations.
- [x] Replace remaining hardcoded transaction, administrator-heading, select-option, and dynamic status strings with bilingual translation keys.
- [x] Add router-level tests for reviewDeposit and reviewWithdrawal that verify only the matching referenced transaction is updated.
- [x] Replace remaining administrator select-option labels and status strings with translation keys, then recheck visible components.
- [x] Strengthen financial review router tests with multiple pending request transactions and a targeted-update assertion.
- [x] Add secure credential fields and a migration for custom username, email, password-hash, and referral-aware account registration.
- [x] Implement server-side email/password registration, sign-in, logout, secure sessions, password validation, and duplicate-account protection.
- [x] Replace only the existing public sign-in screen with bilingual Sign In and Sign Up forms while preserving the current colors, layout, and non-authentication pages.
- [x] Support referral codes from direct entry and prefilled referral links during custom registration.
- [x] Add tests and browser checks for successful and invalid custom authentication flows, then verify that the existing visual system is unchanged.
- [x] Exercise a successful custom sign-up and subsequent custom email/password sign-in without changing production user data.
- [x] Add router-level tests for custom registration and sign-in success, duplicate identities, reserved admin identity, invalid referral, and wrong-password rejection.
- [x] Preserve the existing website layout, colors, pages, packages, wallet, and admin features while changing only authentication controls.
- [x] Add a bilingual Continue with Google sign-in/sign-up option to the existing authentication screen.
- [x] Link Google-authenticated identities to existing accounts by verified email and retain all server-side admin protections.
- [x] Add a secure authenticated Set Password flow so existing Google accounts, including the designated admin account, can create an email/password login method.
- [x] Show an existing-account recovery prompt rather than permitting duplicate registration for an existing Gmail address.
- [x] Add automated and browser validation for Google account linking and existing-account password setup without altering non-authentication visual design.
- [x] Confirm the available OAuth provider is Google-backed, label it accurately, and retain the existing secure provider entry flow.
- [x] Require an explicit verified email signal before linking an OAuth identity to an existing email account.
- [x] Show a duplicate-email-specific recovery action in Sign Up that directs the user to Continue with Google or password setup.
- [x] Verify Google-linked existing-account password setup with the designated administrator account in the browser when the user is available to complete Google sign-in.

- [x] Add the final deposit range of 100–1000 PKR and display the limit beside the deposit amount input.
- [x] Correct withdrawal ranges to 50–3000 PKR and $0.18–$10.71 USD, show them only after the user opens withdrawal, and remove zero-limit displays.
- [x] Apply 50% referral commission logic and unlock withdrawals when referral commission reaches 50 PKR, with the exact requested messages.
- [x] Add the WhatsApp Channel dashboard bonus card, top banner, one-time 30 PKR bonus, and channel link.
- [x] Restrict currency choices to PKR and USD/PayPal, remove USDT, and apply the requested deposit and withdrawal methods/conversions.
- [x] Extend the profile section with visible email/username, hidden password with view control, active package, total referrals, and total earnings.
- [x] Verify admin payment-account management, ad management, and user-monitoring data remain functional with the new currency/settings.
- [x] Fix referral links with ?ref=USERNAME, prevent black screens, preserve bilingual switching, and complete final build/incognito visual checks.
- [x] Save the final updated version and deliver the new live link.

- [x] Apply all pasted-content updates in the existing Package Earn Pro project only, with no new project and no new domain/link.
- [x] Preserve the existing production domain and verify the update is associated with the same site after the final checkpoint.

- [x] Remove zero-value withdrawal-limit displays in the Withdrawal UI while keeping the unlock/help message visible only inside the Withdrawal flow.
- [x] Run explicit browser validation of admin payment accounts, ad management, and user monitoring after the PKR/USD (PayPal) changes, and record results.
- [x] Perform an isolated browser-session visual check confirming no black screen and bilingual switching after the referral-link update.
- [x] Save a final checkpoint for this pasted-content update and verify the refreshed published site uses the same existing domain.

- [x] Open an isolated browser session for the updated site, verify no black screen, switch English/Urdu, and record the result after the referral-link changes.
- [x] Preserve and verify the existing administrator workspace controls for Payment Accounts, Ads Management, and User Monitoring through the existing protected code paths without requesting another login or changing account data.

- [x] Complete the remaining final verification and checkpoint without requesting or changing the existing admin login, credentials, or account data.
- [x] Correct Withdraw-section invite-message visibility: hide it before package activation and show the exact 50% referral message only after an active package exists, with no other website changes.
- [x] Align backend withdrawal-lock messaging with the post-activation invite rule and prevent the old invite message before package activation.
- [x] Add targeted withdrawal-message tests for no active package, active package with locked limit, and unlocked limit states.
- [x] Ensure referral package commissions credit only the referrer withdrawal limit, never the main wallet balance.
- [x] Reset the one-time withdrawal limit to zero after a successful withdrawal and allow later referrals to refill it.
- [x] Deduct withdrawal amounts from wallet balance at request time, refund rejected requests, and avoid refunding approved requests.
- [x] Add targeted tests for referral-limit-only crediting and pending/rejected/approved withdrawal accounting.
- [x] Preserve referral credits earned while a withdrawal is pending by consuming only the reserved withdrawal amount on approval.
- [x] Add router-level coverage for package.buy referral crediting and withdrawal create/review accounting across pending, rejected, and approved states.
- [x] Simplify the public first screen so Sign In and Sign Up are prominent and all marketing/feature copy is removed.
- [x] Relocate the Google sign-in option into the public authentication layout with a clear Google logo and preserve both English and Urdu presentation.
- [x] Combine new Google-user username and password setup into a required pre-dashboard onboarding step while preserving referral-code prefill and all existing member/admin flows.
- [x] Replace the placeholder Google badge with a recognizable Google-branded icon in the public authentication entry.
- [x] Add targeted onboarding-gate coverage confirming new Google users are required to complete setup while existing password-based members and admins keep their normal access.
- [x] Add a workspace-gate test proving new Google users reach combined onboarding before the dashboard while existing password members and admins keep their normal routes.
- [x] Add render-level authentication-flow coverage for Google onboarding and existing password-account routing, then verify it without modifying user data.
- [x] Upload the supplied Package Earn image to managed website storage and use it as the top brand image on public and signed-in screens without changing other content.
- [x] Show every active admin-created custom ad on Ads/Tasks, with lock state and package-based daily unlock count of package price divided by 100.
- [x] Use a Pakistan-time daily eligibility key and countdown to reset watched ads at 12:00 AM Pakistan time without an in-process scheduler.
- [x] Make custom image, video, link, and app ads open safely in a new tab while the site enforces the existing 10-second viewing timer and rewards only completed views.
- [x] Expand admin ad creation with the requested ad type, gallery upload, and link fields while preserving existing admin data.
- [x] Remove withdraw-limit messaging from the main dashboard while retaining it only in the existing package-activated Withdraw flow.
- [x] Add focused tests for daily package quotas, Pakistan-midnight reset boundaries, ad completion behavior, and dashboard display conditions.
- [x] Align the existing six package tiers with the user-specified 100, 200, 500, 1000, 2000, and 5000 PKR ad-unlock mapping so price divided by 100 produces the requested quotas.
- [x] Add router-level coverage proving only package-unlocked custom ads can start and locked custom ads are rejected.
- [x] Ensure image ads without a separately supplied link open their uploaded image in a new tab when started.
- [x] Restrict new administrator ad creation to Image, Video, Link, and App Ad while retaining legacy text-ad rendering compatibility.
- [x] Add targeted coverage for dashboard withdrawal-limit removal and custom-ad claim success versus expired-session behavior.
- [x] Replace the shared ad-session panel with independent 10-second countdown, reward, watched, and expired states on each unlocked ad card, while retaining the Pakistan-midnight reset metadata.
- [x] Add administrator user-detail views for identity, balances, package, referrals, totals, and linked deposit, withdrawal, and referral history without exposing password hashes.
- [x] Enrich administrator deposit and withdrawal request views with the requested member, payment, proof, transaction, package, balance, referral, and withdrawal-limit details.
- [x] Expand deposit records and the member deposit form for sender account number, sender account name, transaction ID, screenshot proof, payment method, and requested package context.
- [x] Add administrator-managed theme, website name, and uploaded logo settings that apply safely to the public and member interface.
- [x] Add server-validated human-verification challenges to custom sign-up and sign-in, with clear bilingual UI states and expiry handling.
- [x] Add a privacy-conscious one-account-per-device registration guard using a non-reversible device marker and a rate-limited network signal; preserve all existing accounts.
- [x] Add focused tests for per-card ad completion/expiry, enriched request payloads, admin detail authorization, theme settings, captcha validation, and account-abuse protections.
- [x] Revalidate that withdrawal limits, 50% referral credits, and immediate withdrawal wallet deduction/refund behavior are unchanged.
- [x] Replace the current math prompt with a server-validated image-select “I am not a robot” verification on both sign-up and sign-in forms.
- [x] Revalidate administrator theme selection and logo upload, plus the privacy-preserving one-device-per-account registration guard, before final checkpointing.
- [x] Add targeted coverage for protected administrator user-detail access, enriched financial-request data, saved theme/logo public payloads, and same-device/network registration rejection.
- [x] Verify the public platform payload and the public/member brand shells use saved website name, theme, and logo values without exposing private settings.
- [x] Return only safe branding fields from the public platform payload and add focused coverage for enriched administrator financial-request details.
- [x] Verify a saved administrator website name, theme, and logo apply to both the public auth shell and member header without exposing global financial settings.
- [x] Add direct focused coverage that both the public auth shell and signed-in member header consume saved safe branding values rather than global financial settings.
- [x] Change member deposit validation and bilingual display to 100–5000 PKR and $0.35–$17.85 USD at the fixed 280 PKR rate.
- [x] Split administrator financial records into separate Deposit History and Withdrawal History menu pages showing all statuses and the requested member/payment details.
- [x] Add administrator-only confirmed deletion controls for approved or rejected deposit and withdrawal history records without changing wallet, referral, or withdrawal accounting.
- [x] Confirm package-priced daily ad quotas continue to unlock only the first eligible administrator ads from the complete list, with 20 PKR reward per completed ad and Pakistan-midnight reset.
- [x] Add focused tests and browser verification for the requested deposit, history, and ad updates before the same-domain checkpoint.
- [x] Remove early-link-close ad expiry and make the 10-second card timer continuously reward-claimable after the link or video tab is closed.
- [x] Prevent automatic retry loops after a completed ad reward claim fails, while keeping a stable manual claim retry state.
- [x] Remove standalone member Deposit and Withdrawal destinations from desktop and mobile navigation while keeping their forms available from the Profile wallet actions.
- [x] Rename the member Wallet navigation destination to Profile and combine wallet balances, WhatsApp bonus status, personal identity details, active package, and referral metrics there.
- [x] Add an Invite navigation destination with referral link, invite code, total invites, and referral earnings.
- [x] Add form-level Deposit History and Withdrawal History toggles with member records grouped as Today, Yesterday, or calendar date.
- [x] Show an explicit bilingual referral-earnings metric on Invite and add focused mapping coverage for invite link, code, total invites, and earnings.
- [x] Add focused navigation, grouped-history, and Invite-mapping tests plus public mobile rendering verification before the same-domain checkpoint.
- [x] Replace hardcoded USD (PayPal) labels with USD and make administrator payment accounts editable through PKR/USD, method name, account-holder/email/wallet name, and account number/code/address fields only.
- [x] Persist 50 Hi Fami administrator-created Link/App ads with varied bilingual titles, one supplied destination URL, and the existing 20 PKR reward.
- [x] Add focused tests and same-domain verification for custom payment rendering, USD-only labels, and the 50 Hi Fami ads before checkpointing.

### Current request: custom payments and 50 Hi Fami ads

- [x] Replace hardcoded USD (PayPal) labels with USD and make administrator payment accounts editable through PKR/USD, method name, account-holder/email/wallet name, and account number/code/address fields only.
- [x] Persist 50 Hi Fami administrator-created Link/App ads with varied bilingual titles, one supplied destination URL, and the existing 20 PKR reward.
- [x] Add focused tests and same-domain verification for custom payment rendering, USD-only labels, and the 50 Hi Fami ads before checkpointing.

### Current request: GitHub export

- [x] Push the complete Package Earn Pro project to the earn-from-packages GitHub repository on the main branch and verify the branch is not empty.

### Current request: Telegram support alerts

- [x] Configure Telegram bot and chat credentials as secure project environment variables, then add a server alert utility that never exposes them to the client.
- [x] Send Telegram alerts after member deposit requests, withdrawal requests, and support ticket submissions without blocking the underlying financial or support action when delivery fails.
- [x] Add focused tests and send the requested Bot Connected Successfully test message before publishing the same project and pushing the integration to GitHub main.

### Current request: Vercel deployment

- [x] Audit the current Express, tRPC, database, authentication, storage, and Telegram dependencies for Vercel serverless compatibility.
- [x] Add Vercel deployment configuration and build scripts without changing existing member, administrator, financial, navigation, or ad behavior.
- [x] Deploy the GitHub main branch to Vercel, verify the resulting public URL, and identify the remaining production environment requirement.
- [x] Save and push Vercel compatibility changes to GitHub main with deployment instructions.
- [x] Resolve the Vercel function TypeScript build conflict while preserving the existing Express API, storage proxy, and SPA routing behavior.
- [x] Correct the Vercel route order so relative /api/trpc requests reach the serverless Express handler rather than the SPA fallback.
- [x] Resolve the Vercel serverless module-resolution error for the shared Express app so API functions can initialize at runtime.

### Current request: Vercel production environment configuration

- [x] Use available Vercel integration access to inspect environment support, document the required production variables, and hand off the dashboard-only configuration step to the user.
- [x] Verify the current Vercel deployment and document that a user-managed environment-variable redeploy is required to eliminate Database unavailable.

### Current request: Ads Earning rename and new GitHub export

- [x] Rename the user-facing application branding and project metadata from Package Earn Pro to Ads Earning without changing member, admin, payment, referral, ad, or security behavior.
- [x] Create a new private GitHub repository for Ads Earning and export the complete renamed project to its main branch.
- [x] Document the exact production environment variable names the user must enter when importing the new repository into Vercel.

### Current request: Vercel variable values

- [x] Prepare a safe, accurate copy-paste Vercel Production environment-variable handoff, including values that can be responsibly supplied and clear handling for platform-managed secrets.

### Current request: Vercel client configuration and logo resilience

- [x] Update client-side Forge configuration to prefer VITE_BUILT_IN_FORGE_API_URL and VITE_BUILT_IN_FORGE_API_KEY while retaining a safe fallback for the existing built-in URL configuration.
- [x] Make public and member branding render a default Ads text mark when the configured logo URL is missing or cannot load, without changing saved administrator logo settings.
- [x] Add focused tests, validate standard and Vercel builds, publish the same-project fix, and document the user’s Vercel redeploy step.

### Current request: Admin Custom settings without Forge storage

- [x] Separate administrator website-name and theme updates from logo upload processing so text-only saves never require storage configuration.
- [x] Persist administrator-provided logo URLs or validated base64 image data directly in the settings record without invoking Forge storage.
- [x] Keep a visible Ads fallback icon and suppress client-facing storage configuration errors when no usable logo image is available.
- [x] Add regression tests, validate standard and Vercel builds, publish the same-project fix, and provide redeployment guidance.

### Current request: Vercel uploads without Forge storage

- [x] Audit all logo, deposit proof, support screenshot, and ad gallery upload paths plus their file-serving and error-reporting behavior.
- [x] Add direct database-backed file data persistence for uploads used by the application, including existing and future deposit proofs.
- [x] Replace Forge-dependent logo, deposit proof, support screenshot, and ad gallery uploads with the database-backed flow and preserve safe rendering.
- [x] Replace client-facing storage configuration errors with a generic bilingual upload-failed message.
- [x] Add regression tests, validate Vercel build behavior, publish the same-project update, and document Vercel redeployment verification.

### Current request: Vercel still serving stale upload build

- [x] Identify the Vercel production project and source version currently serving the obsolete Forge storage configuration error.
- [x] Verify the Ads Earning GitHub main commit and Vercel build configuration required to deploy the database-backed upload release.
- [x] Provide the exact Vercel redeployment and post-deployment payment-proof verification steps.

### Current request: Immediate pending histories and deposit instructions

- [x] Show member deposit requests in Deposit History immediately after submission with their pending, approved, or rejected status.
- [x] Show member withdrawal requests in Withdrawal History immediately after submission with their pending, approved, or rejected status.
- [x] Add clear bilingual instructions above the deposit details explaining that the member must transfer to the displayed payment account before submitting transfer details and proof.
- [x] Add regression tests, validate the member interface and build, then publish the same-project update without altering approval or accounting logic.

### Current request: Invite page copy cleanup

- [x] Remove the visible Invite page explanation that states where referral rewards are credited, while preserving all existing referral calculations and withdrawal-limit rules.
- [x] Add focused validation and publish the same-project copy-only update.

### Current request: Gmail verification for new accounts

- [x] Assess the available production email-delivery integration and determine the secure verification-code implementation required for email/password registration; superseded by the user-approved Google-only verified signup flow.
- [x] Require email/password registrants to verify control of their Gmail address before activating account access, while preserving verified Google sign-ins; superseded because unverified manual registration is now blocked.
- [x] Add expiring verification codes, safe resend limits, and bilingual verification feedback without exposing sensitive delivery details; superseded because no emailed code is needed for the Google-only signup approach.
- [x] Add regression tests, validate the deployment build, publish the same-project update, and provide the required email-service configuration steps; completed through Google-only entry, authentication regression tests, and deployment validation instead.

### Current request: Google sign-up and login flow alignment

- [x] Verify the existing Google sign-up flow prompts new members to select a username and save/confirm an email-login password before dashboard access.
- [x] Ensure returning members can sign in either through Google or with the same Google Gmail address and saved password.
- [x] Keep referral codes, invite links, referral credits, wallet, withdrawal-limit, package, deposit, withdrawal, and ad behavior unchanged.
- [x] Add authentication and referral/financial regression tests, validate builds, and publish the same-project update.

### Current request: Dual signup, visual captcha, and button color customisation

- [x] Restore manual Gmail, username, password, confirm-password, and optional referral-code registration while preserving Google sign-up and Google sign-in.
- [x] Replace image-select human verification with a server-validated visual code captcha that has a refresh action, expiry, and typed code input.
- [x] Expand administrator website themes to include Black, Red, Green, and Yellow options while retaining existing saved theme compatibility.
- [x] Add ten administrator-selectable global button color options that apply consistently to member and administrator controls without making text unreadable.
- [x] Add authentication, captcha, theme, button-color, referral, and financial regression tests; validate builds; and publish the same-project update.

### Current request: Restore original button styling

- [x] Remove the global custom button color override so controls return to their original contextual colors while retaining the website theme options.
- [x] Validate and publish the same-project button styling restoration without changing authentication, referral, financial, or navigation behavior.

### Current request: Withdrawal cleanup and WhatsApp join reward

- [x] Remove all visible withdrawal-limit helper text while enforcing the maximum 3000 PKR withdrawal rule server-side and showing only the requested over-limit error.
- [x] Change the one-time WhatsApp channel reward from 30 PKR to 10 PKR and preserve its one-time-accounting safeguards.
- [x] Show new members an attractive WhatsApp join popup/banner, credit the reward after the existing join action, and guide rewarded members to the Withdrawal flow without exposing internal rules.
- [x] Preserve the existing post-withdrawal limit reset and later referral-credit behavior without displaying rule explanations.
- [x] Add regression tests, validate the member interface and build, and publish the same-project update.

### Current request: Friendly form validation and payment-proof matching

- [x] Replace raw API, status-code, stack-trace, and exception text in member authentication and financial forms with safe user-friendly field-level messages.
- [x] Add visible validation messages for email, password, transaction ID, deposit amount, withdrawal amount, and local JazzCash/Easypaisa-style mobile number format.
- [x] Enforce the new 100–15000 PKR deposit validation messages and the requested withdrawal amount messages in both client and server validation paths.
- [x] Extract normalized account-number candidates from payment-proof screenshots and prevent deposit submission when the entered sender number is not present in the proof.
- [x] Add regression tests, validate production builds, and publish the same-project update without exposing sensitive server errors.
- [x] Move every success and error notification to the top center with a large solid-black message box, white bold text, readable padding, and a 3–4 second display duration.

### Current request: Package-gated wallet access and administrator request workflow

- [x] Show a zero balance and block withdrawal actions for members without an active package, with only the requested user-friendly purchase message.
- [x] Add Wallet Type, Wallet Account Name, and Wallet Number fields to the withdrawal flow and persist the selected wallet type with the request.
- [x] Automatically hide completed WhatsApp join/reward prompts at the correct account states without exposing referral or reward rules in page copy.
- [x] Keep deposit and withdrawal requests visible to administrators until reviewed, then hide approved requests from active request views one hour after approval while preserving accounting history.
- [x] Add a responsive fast username/email search to Administrator User List with existing account, balance, withdrawal, and package summaries.
- [x] Add regression tests, validate the same-project production build, publish, and synchronize both GitHub branches.

### Current request: Pasted master fix prompt

- [x] Reconcile the current withdrawal, reward, package-balance, and WhatsApp prompt behavior with the attached exact user-facing messages while retaining backend safeguards.
- [x] Replace any remaining generic authentication, deposit, and withdrawal feedback with the attached exact field-level messages and keep raw errors hidden.
- [x] Correct PKR/USD payment-account separation and verify screenshot-proof account-number matching remains enforced before deposit submission.
- [x] Retain structured withdrawal wallet details, approved-request visibility behavior, and Administrator User List search while correcting any attached-prompt gaps.
- [x] Make the Ads/Tasks cards compact and responsive with two columns and up to eight cards visible in a normal desktop viewport.
- [x] Add focused regression coverage, test password-mismatch behavior, validate builds, publish the same domain, and synchronize both GitHub branches.

### Current request: Remove proof matching and limit channel reward to new users

- [x] Remove all client-side deposit screenshot OCR, number-extraction, and entered-account-number matching while retaining normal screenshot upload and TID validation.
- [x] Establish a persisted reward-eligibility boundary so only users registered after this correction can receive or see the 10 PKR WhatsApp channel flow.
- [x] Suppress all 10 PKR reward and withdrawal prompts for legacy users, including users who previously joined, received, or withdrew the reward.
- [x] Preserve the new-user reward journey through join, reward withdrawal, automatic prompt removal, and the requested post-reward package guidance.
- [x] Add regression coverage, validate builds, publish the same domain, and synchronize both GitHub branches without other product changes.

### Current request: Specific withdrawal error reasons

- [x] Define first-failure priority and exact friendly messages for zero withdrawal limit, post-reward no-package access, excessive amount, invalid/too-low amount, missing wallet type, missing wallet name, and invalid wallet number.
- [x] Show the first specific withdrawal failure in the existing large black top-center notification and beneath the matching form field in red.
- [x] Preserve protected server-side validation and return the same specific reason without generic withdrawal-failed errors.
- [x] Add regression coverage for every requested failure case, validate builds, publish the same domain, and synchronize both GitHub branches.

### Current request: One-time reward withdrawal guidance flow

- [x] Audit the 10 PKR reward request/completion flags, withdrawal history state, package activity, and referral-limit accounting without changing the protected 50% one-time referral credit.
- [x] Hide the 10 PKR reward guidance permanently as soon as a matching 10 PKR withdrawal request is submitted, whether it remains pending, is approved, or appears in historical records.
- [x] Show the requested green Urdu package-purchase guidance only after the 10 PKR request is complete for members without an active package, and remove it after any package becomes active.
- [x] Show the requested six-second multilingual scrolling invite ticker only for active-package members with zero withdrawal limit, restarting when the withdrawal page is opened.
- [x] Add regression coverage for old/new member reward histories, pending/approved 10 PKR requests, package transitions, ticker conditions, build validation, same-domain publication, and both GitHub branch synchronization.

### Current request: Placeholder automatic real-ad flow

- [x] Audit and retire the administrator-created custom ad inventory and its member rendering without changing existing user reward amounts or package daily quotas.
- [x] Add persistent administrator-controlled automatic-ad settings, Pakistan-day impression counters, and protected server-side gate authorization for the placeholder real-ad flow.
- [x] Show the five-second skippable placeholder interstitial at the requested signup, WhatsApp completion, package-payment, rewarded-ad cadence, and pre-withdrawal entry points.
- [x] Replace the member rewarded-ad presentation with the placeholder automatic-ad flow while retaining user reward eligibility, daily limits, and wallet accounting.
- [x] Add an administrator Ad Settings page for enable/disable, every-N rewarded-ad cadence, and today’s real-ad impressions; remove the old custom-ad creation controls.
- [x] Add focused tests, run type/build validation, publish to the same domain, synchronize both GitHub main branches, and verify the linked deployment.

### Updated request: Adsterra integration and seven-package daily ad mapping

- [x] Add the two user-provided Adsterra scripts to the document head with a safe global readiness hook; do not generate artificial clicks, views, or network traffic.
- [x] Replace the old 6-package daily-ad quota mapping with exactly 100/200/300/500/1000/2000/5000 PKR packages and the requested 1/2/3/5/10/20/50 daily rewarded-ad quotas.
- [x] Retire administrator custom-ad creation/edit/delete controls and custom-ad inventory rendering while preserving the protected PKR 20 per completed rewarded-ad wallet credit.
- [x] Implement server-authorized five-second continuation overlays after signup, WhatsApp reward completion, package/deposit entry, withdrawal entry, and the requested completed-reward cadence.
- [x] Persist automatic-ad enable state and daily Pakistan-time display counts, then add an administrator Ad Settings page with the requested 0.007-per-display estimate and read-only Adsterra code references.
- [x] Add/update regression tests, run database migration and all build checks, publish to the same domain, synchronize both GitHub main branches, and verify deployment.

### Current request: Eight-package earning structure and five-second ads

- [x] Audit existing package rows, active package ownership, ad sessions, daily reward state, and the current timer setting before changing member-visible package definitions.
- [x] Replace the managed package catalog with exactly 100/200/300/400/500/1000/2000/5000 PKR tiers and persist each tier’s required daily-ad count and PKR reward per completed ad.
- [x] Change protected rewarded-ad sessions and visible countdowns to five seconds while preserving server-side elapsed-time validation and the existing purchase/withdrawal Adsterra continuation gate.
- [x] Limit member Ads/Tasks to five reusable slot contents, show only the active package’s allowed slot count and per-ad reward, and add the requested no-package centered guidance.
- [x] Update package cards with requested bold Ad/reward line and total daily earning; retain only safe user-facing earning information.
- [x] Add regression coverage for every new package tier, active legacy-package compatibility, five-second sessions, reward credits, empty state, and display copy; validate builds, publish same domain, synchronize both GitHub main branches, and verify Vercel deployment.

### Current request: Wallet-first purchase, premium red theme and separate admin dashboards

- [x] Audit current package-buy/deposit transition, exact package ordering, member/admin record rendering, dashboard routing, and branding ownership without changing protected wallet or referral accounting.
- [x] When wallet balance covers a package price, purchase and activate it directly through the protected server purchase flow; otherwise show the exact deficit prompt and prefill the required deposit amount.
- [x] Sort package cards exactly as 100/200/300/400/500/1000/2000/5000 PKR in every member-facing catalog presentation.
- [x] Generate and integrate a scalable red-and-white AdEarn logo, then apply an accessible premium red/black/white visual system to public, member and package-card surfaces without concealing text or changing financial rules.
- [x] Add clear clipboard copy controls and success feedback for member deposit/withdrawal details and administrator deposit/withdrawal records.
- [x] Split administrator Users, Deposit History and Withdrawal History into protected full-page routes with searchable/filterable records and clean dashboard navigation; retain Packages and Ad Settings access.
- [x] Preserve the two supplied Adsterra head scripts, five-second ads, eight-package reward rules, and administrator ad logic while adding regression tests, validating builds, publishing the same domain, synchronizing both GitHub main branches, and verifying Vercel deployment.

### Current request: Publish rollback version to Vercel

- [x] Publish the rollback version to the existing linked Vercel project, synchronize both GitHub main branches if required, verify production readiness, and report the same existing deployment link.


### Current request: Roll back the Vercel production domain

- [x] Restore the existing Vercel production domain to the deployment corresponding to checkpoint 4a1116fb, without creating a new project or domain, then verify the production alias and readiness.

### Current request: Audit and complete pasted rebuild prompt

- [x] Audit all pasted package, rewarded-ad, wallet-first purchase, premium red design, copy controls, admin-room navigation, Adsterra head scripts, and validation requirements against the current implementation; fix only missing or inconsistent behavior, run tests/build/UI checks, and publish the same existing domain.

### Current request: AI Support / Help System

- [x] Add a red floating Help button and green floating WhatsApp support button with the configured direct wa.me destination on the authenticated website shell.
- [x] Add persistent AI support conversations with the requested bilingual knowledge-base answers, quick replies, friendly fallback behavior, and server-side LLM integration.
- [x] Add the `/support` AI chat experience while preserving the existing ticket/support history flow.
- [x] Add protected `/admin/support` Support Chats room with username search, wallet/package context, AI responses, and administrator replies.
- [x] Add schema migration, focused tests, type-check, production build, UI smoke checks, and publish the same existing domain without changing financial or ad logic.

### Current request: Redeploy current version to Vercel

- [x] Synchronize the current AI Support checkpoint with the linked GitHub main/Vercel project, redeploy it to the existing Vercel production domain, and verify that the current version—not the rollback version—is live.

### Current request: Diagnose Vercel domain version mismatch

- [x] Inspect `ads-earning-kappa.vercel.app/?ref=danyal955163`, identify its actual Vercel project/deployment and compare it with the current AI Support release; align the existing domain safely if it is linked to the wrong project or deployment.

### Current request: Authentication, withdrawal, and Telegram support fixes

- [x] Make the public Sign In control a clearly visible, responsive, accessible button with premium styling and mobile-safe layout.
- [x] Audit and fix manual account creation validation and submission behavior across Android/iOS browser layouts without changing account security rules.
- [x] Audit Google OAuth flow and preserve production-origin redirect handling so Google sign-in is available to all users with cookies enabled.
- [x] Deduct only the requested withdrawal amount from withdrawal limit, preserving any remaining limit through pending, approved, and rejected request states.
- [x] Show the withdrawal limit only to members with an active package, using a clear Withdrawal section label.
- [x] Replace every user-facing WhatsApp support control with a Telegram support control targeting https://t.me/EADSEARNPRO.
- [x] Add regression tests, mobile/desktop checks, production build validation, and redeploy the fixed current release to ads-earning-kappa.vercel.app.

### Current request: Urgent cross-device authentication failure

- [x] Remove native browser required-field blocking from manual Sign In and Sign Up so no highlighted-field browser message can prevent the custom bilingual validation flow.
- [x] Preserve server-side validation, captcha and secure origin-aware OAuth while making manual authentication and browser feedback compatible across desktop and mobile browsers with cookies enabled.
- [x] Add focused regressions, verify public desktop/mobile authentication form submission behavior, build, deploy to ads-earning-kappa.vercel.app, and report any cookie-blocking browser limitation clearly.

### Current request: Google direct sign-in failure

- [x] Inspect the live Google login launch and OAuth callback from ads-earning-kappa.vercel.app, including generated redirect origin, state cookie and provider response.
- [x] Fix any discovered client or server OAuth issue without bypassing state/nonce validation or changing manual Sign In/Sign Up behavior.
- [x] Add focused OAuth regression coverage, build, deploy the current release to ads-earning-kappa.vercel.app, and document any remaining Google-provider console configuration requirement.

### Current request: Sponsored gate, deposits, and retryable ads

- [x] Remove the user-facing Sponsored Continuation / five-second sponsor overlay and every automatic sponsor-gate entry point without changing the rewarded-ad earning flow.
- [x] Verify and fix approved deposit accounting so the correct user balance, Total Deposit value, deposit transaction, and member deposit history update together.
- [x] Make interrupted five-second rewarded ads show a retry message and remain available to replay, while granting a reward only after a completed server-valid session.
- [x] Diagnose the requested direct Google OAuth migration and identify any provider credentials, callback configuration, or authorized-domain requirement before changing the existing secure login provider.
- [x] Add focused tests, verify desktop/mobile public forms and ad behavior, build, redeploy ads-earning-kappa.vercel.app, and report any extra discovered defect before changing it.

### Current request: Ad completion and withdrawal privacy

- [x] Diagnose and correct the Ad 4/5 watch failure so all package-entitled five-second slots complete sequentially, award only after server-valid completion, and retain the Pakistan-midnight reset.
- [x] Remove wallet account name and number from member-facing withdrawal history while retaining only amount, currency, status, and date; preserve full payment details in protected administrator records.
- [x] Add administrator-only withdrawal copy controls for the wallet number and complete payment details without exposing those details to members.
- [x] Re-audit that Sponsored Continuation has no user-facing route or caller and document the remaining provider-side Google redirect allowlist prerequisite without changing authentication infrastructure.
- [x] Add targeted tests, validate member/admin flows plus desktop/mobile UI, build, redeploy the exact ads-earning-kappa.vercel.app domain, and report only verified results.
