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

- All writes to products/product_costs/sales go through SECURITY DEFINER RPCs (add_product, complete_sale); tables have no insert/update/delete policies, so nothing can be deleted or edited directly.
- Roles live in public.user_roles (checked via has_role), not on profiles, to prevent self-promotion; purchase cost is in product_costs, readable only by owners via RLS.
- Add Product / Sell require a scanned staff code (profiles.staff_code); the RPCs re-verify it via check_staff_code so the UI check can't be bypassed.
- A sale's shop is the scanning staff member's shop (not the phone's), so the dashboard can flag cross-shop sales.
- Sales RLS: owners see all, staff see only sales where shop_id = my_shop_id(); new staff accounts are created by the owner-only createStaff server function.
- Pure business rules (bulk row checks, supplier paid amounts, dashboard alerts) live in src/lib/bulk.ts and src/lib/alerts.ts with tests in src/test/rules.test.ts.
- Netlify deploy uses netlify.toml with NITRO_PRESET=netlify (server rendering via a Netlify Function), not an SPA redirect, because routes render on the server.
