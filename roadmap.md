# Requested additions
- [x] Shop profiles, private logo uploads, and shared current-shop selection
- [x] Atomic multi-phone checkout and complete thermal/A4 receipts with reprint
- [x] Scanner-friendly IMEI validation and camera scanning; permission failure checked, physical-camera decoding unverified
- [x] Complete product labels across add, bulk, and reprints
- [x] Configurable transfer limits, automatic request expiry, overdue cancellation and alerts; scheduled callback checked locally, published delivery requires publishing
- [x] Supplier filters and purchase/batch detail
- [x] 31 passing rule/routing tests and signed-in browser checks, including cart checkout and transfer lifecycle

## Verification limits
- Physical cameras and printers require the user's hardware; print views and camera fallback are checked.
- Real shop contact details and logos were not supplied and remain blank; no invented shop details.
- Test records are retained under Checkout verification / Transfer verification; no existing phones were sold or deleted.- [x] Add Product: staff code (scanner/camera/typing), condition photos, shipping tracking; shown on detail, stock, transfers, sell, dashboard

# Login, staff accounts, audit log
- [ ] Login page (logo, show/hide, remember me, forgot password, role redirect)
- [ ] Invite-only staff accounts (invite, resend, reset, change shop/role, disable/enable), change password
- [ ] Audit log with triggers + auth/print events
- [ ] Owner Activity page (filters, detail, login history, CSV) + product history
- [ ] Dashboard alerts: 3+ failed logins/hour, price edits
