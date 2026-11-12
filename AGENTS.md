<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All writes to products/product_costs/sales go through SECURITY DEFINER RPCs (add_product, complete_sale, complete_cart_sale); tables have no insert/update/delete policies, so nothing can be deleted or edited directly.
- Roles live in public.user_roles (checked via has_role), not on profiles, to prevent self-promotion; purchase cost is in product_costs, readable only by owners via RLS.
- Add Product / Sell require a scanned staff code (profiles.staff_code); the RPCs re-verify it via check_staff_code so the UI check can't be bypassed.
- Cart sales use the selected shop, validated against the caller, staff badge and every phone's current shop; sale line net amounts allocate total discount so reports stay accurate.
- Sales RLS: owners see all, staff see only sales where shop_id = my_shop_id(); new staff accounts are created by the owner-only createStaff server function.
- Pure business rules (bulk row checks, supplier paid amounts, dashboard alerts) live in src/lib/bulk.ts and src/lib/alerts.ts with tests in src/test/rules.test.ts.
- Netlify deploy uses netlify.toml with NITRO_PRESET=netlify (server rendering via a Netlify Function), not an SPA redirect, because routes render on the server.
- Phones have shop_id (bought for) and current_shop_id (where it physically is); selling and stock use current_shop_id. Transfers change location only via request/respond/receive/cancel_transfer RPCs, so a phone in transit can never be sold.

- Shared current-shop context scopes all shop pages; local storage holds only the owner's selection, never authority, and RPCs independently enforce shop access.
- Receipts persist immutable shop and item snapshots with one header per cart; sales remain discounted line records for existing reporting.
- Shop logos use private storage and signed read URLs because workspace policy blocks public buckets.
- Transfer request expiry uses a managed hourly authenticated callback and deadline guards; overdue cancellation is owner-only and logged.
- Browser camera decoding is dynamically imported inside an effect and stops media tracks on exit.
- Product condition photos live in the private product-photos bucket under <product_id>/ and are recorded only via add_product_photos (no update/delete); browser compresses before upload, and photo-count rules live in src/lib/product-extras.ts.
- Shipping carrier/tracking on products changes only via set_product_tracking; carrier tracking URLs are built in src/lib/product-extras.ts.
- Account management (invite, resend, reset, role/shop change, disable) runs in owner-checked server functions in src/lib/staff.functions.ts using the admin client; disabling both bans the auth user and sets profiles.disabled, which has_role honours so access stops immediately.
- audit_log is written only by SECURITY DEFINER triggers/RPCs (audit_row, log_event, log_admin_event), is owner-read-only and blocked from update/delete/truncate by trigger; security alert rules live in src/lib/accounts.ts.
