# Japanese-style POS register

## Experience
- Make a new **Home** screen the destination after login, with shop/staff information and bilingual touch tiles for New Sale, Cash Check, Sales History, Customers, Products, and owner/manager Settings. Keep existing stock, transfers, suppliers, dashboard, and account pages accessible.
- Redesign New Sale with a persistent scanner bar, Tiles/Search/Custom item tabs, category browsing, and a held-sales counter. Phone tiles show model, storage, color, condition, and price; accessory tiles add a unit.
- Add a separate cart screen with timestamps, selection/removal, fixed phone quantities, stock-limited accessory quantities, line and order discounts, and manager/owner price editing.
- Add Payment with optional customer selection, the current staff member by default, the existing staff badge verification, split Cash/Card/PayPay/Bank payments, quick cash amounts, live change, and 10% tax-inclusive totals.
- Add Completion with change, received/total amounts, receipt printing, named 領収書 with 但し書き, QR receipt, and navigation to Home, Sales History, or New Sale.
- Use clean white surfaces, blue accents, large touch targets, and English labels with small Japanese subtitles on the new register screens only.

## Supporting features
- Add shop-based accessory stock with quantity and selling price; preserve phone IMEI tracking unchanged.
- Add a shop-scoped customer directory and optional customer linking on receipts.
- Persist held orders for the shop and originating staff; holding does not reserve inventory. Recheck availability and permissions when resuming and paying.
- Add Cash Check with recorded cash sales, expected cash, counted cash, and difference for the selected shop/day.
- Add owner/manager POS Settings for custom-item availability and staff discount limits. Start the staff discount limit at **0%**, adjustable before staff use discounts; owners/managers can discount freely within the order value. Prices remain tax-inclusive at **10%**.
- Keep old purchases, receipts, sales, and reporting compatible; include accessories and custom items in receipt totals and sales summaries without inventing IMEIs.

## Security and correctness
- Enforce shop access, disabled-account checks, staff badges, price-edit permissions, discount limits, inventory quantities, and payment totals in the database, not only on screen.
- Complete each sale atomically: record one immutable receipt, mark phones sold, reduce accessory stock, save payment breakdown and sale lines, and record audit events. Prevent duplicate checkout submissions from charging or deducting stock twice.
- Keep purchase costs and supplier details hidden from staff. Keep owner-only audit access and existing transfer restrictions.
- QR receipts contain a receipt-specific share link with minimal receipt information, not a public customer directory or a link exposing other receipts.

## Technical implementation
- Add database migrations for accessory inventory, customers, held orders, cash checks, POS settings, payment breakdowns, and non-phone receipt lines, with explicit grants, shop-scoped access rules, validated write functions, and audit triggers.
- Build focused register components and separate authenticated routes for Home, Cart, Payment, Cash Check, Customers, and Settings; keep the existing New Sale and Sales History URLs.
- Extend receipt rendering and shared sales totals to support quantities, inclusive tax, discounts, and split payments while preserving historical phone receipts.

## Verification
- Add tests for 10% inclusive tax, discounts and permission limits, phone/accessory quantities, payment/change calculations, and receipt totals.
- Check the new screens on desktop and mobile, then verify scanning → cart → split payment → saved receipt → sales history with an authenticated account if available.
- This project uses external Supabase with no managed test session currently available. Authenticated checkout verification may require you to sign in; physical scanner, camera, and printer checks require your hardware.

## Unchanged
Existing product intake, supplier directory, transfers, shop profiles, account invitations, historical data, and the design of unrelated pages.