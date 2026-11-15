-- Retire Cash Check without changing any historical tables or records.
-- Checkout must not depend on a shop's historical open/closed cash session.
DROP TRIGGER IF EXISTS closed_register_sales ON public.receipts;