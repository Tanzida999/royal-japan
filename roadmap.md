# English-only interface and Cash Check removal
- [x] English labels throughout POS, navigation and receipts; preserve yen and stored Japanese data
- [x] Remove Cash Check page, links, tile, dashboard reads and alerts; preserve tables/history
- [x] Remove historical closed-register restriction from checkout
- [x] 63 tests pass; receipt cash guard removed, cash tables retained; desktop/mobile sign-in and retired page checked
- [ ] Real-account POS and Home read-back — external Supabase has no managed sign-in session

# Requested additions
- [x] Consistent shared header/navigation, blue controls, aligned page widths and Home tiles
- [x] 88 isolated sample-page checks at 1440, 1024, 768 and 390px; no page overflow or runtime errors, hamburger navigation checked
- [x] Held-sale names/notes, atomic phone reservations, reasoned cancellation and automatic 24-hour expiry
- [x] Shop register sessions, reasoned cash in/out, denomination checks and immutable printable close reports
- [x] Owner close-report visibility and nonzero cash-difference dashboard alerts; audit all actions
- [x] 61 tests, active hourly SQL expiry job, policy/trigger inspection and signed-out desktop/mobile checks
- [ ] Signed-in held-sale reservation/cancel/resume read-back — external Supabase has no available managed test session; Cash Check is retired
- [x] Japanese-style POS home and touch-friendly sale, cart, payment, and completion screens
- [x] Shop-scoped accessories, customers, held sales, cash check, and POS settings
- [x] Atomic mixed-item checkout, discount permissions, split payments, inclusive tax, receipts, and audit logging
- [x] 54 rule/routing tests, database policy checks and desktop/mobile signed-out checks
- [ ] Signed-in POS scanning, held-order resume, split checkout, saved receipt read-back and register layout verification — external Supabase has no available managed test session
- [x] Supplier directory, active supplier selection and legacy purchase linking
- [x] Owner/manager supplier access, shop-scoped sales and receipt security
- [x] New Sale / Sales History labels and today's shop totals
- [x] 47 tests, database policy inspection and signed-out page checks
- [ ] Signed-in supplier creation/edit/deactivation, purchase intake and sales/receipt verification — external Supabase has no available managed test session
- [x] Shop profiles, private logo uploads, and shared current-shop selection
- [x] Atomic multi-phone checkout and complete thermal/A4 receipts with reprint
- [x] Scanner-friendly IMEI validation and camera scanning; permission failure checked, physical-camera decoding unverified
- [x] Complete product labels across add, bulk, and reprints
- [x] Configurable transfer limits, automatic request expiry, overdue cancellation and alerts; scheduled callback checked locally, published delivery requires publishing
- [x] Supplier filters and purchase/batch detail
- [x] 31 passing rule/routing tests and signed-in browser checks, including cart checkout and transfer lifecycle

## Verification limits
- Layout checks use isolated sample responses, not real signed-in accounts; authenticated production-data checks remain unavailable with external Supabase. All 61 existing tests pass.
- Close reports include refunds as ¥0 because the app has no refund flow or refund records; no refund functionality was invented. Hardware printing and signed-in cash/reservation flows remain unverified.
- Register functions intentionally remain callable by authorized signed-in users; shared receipts intentionally allow bearer-link reads of a narrow non-sensitive projection. Reviewed linter flags reflect this access model. Existing leaked-password protection is disabled.
- No separate purchase-batches page or table exists; existing bulk purchase grouping uses the same supplier dropdown and linked phone records.
- Physical cameras and printers require the user's hardware; print views and camera fallback are checked.
- Real shop contact details and logos were not supplied and remain blank; no invented shop details.
- Test records are retained under Checkout verification / Transfer verification; no existing phones were sold or deleted.- [x] Add Product: staff code (scanner/camera/typing), condition photos, shipping tracking; shown on detail, stock, transfers, sell, dashboard

# Login, staff accounts, audit log
- [x] Login page (logo, show/hide, remember me, forgot password, role redirect)
- [x] Invite-only staff accounts (invite, resend, reset, change shop/role, disable/enable), change password
- [x] Audit log with triggers + auth/print events
- [x] Owner Activity page (filters, detail, login history, CSV) + product history
- [x] Dashboard alerts: 3+ failed logins/hour, price edits
