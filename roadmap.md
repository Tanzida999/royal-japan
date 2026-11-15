# Requested additions
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
