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
