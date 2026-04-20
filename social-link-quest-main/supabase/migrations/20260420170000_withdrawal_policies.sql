-- Allow public to insert withdrawals (user creates own request)
DROP POLICY IF EXISTS "Users create own withdrawals" ON public.withdrawals;
CREATE POLICY "Users create own withdrawals"
  ON public.withdrawals FOR INSERT TO public
  WITH CHECK (true);

-- Allow public to read all withdrawals (admin needs to see all)
DROP POLICY IF EXISTS "Public read withdrawals" ON public.withdrawals;
CREATE POLICY "Public read withdrawals"
  ON public.withdrawals FOR SELECT TO public
  USING (true);

-- Allow public to update withdrawals (admin approve/reject + refund)
DROP POLICY IF EXISTS "Public update withdrawals" ON public.withdrawals;
CREATE POLICY "Public update withdrawals"
  ON public.withdrawals FOR UPDATE TO public
  USING (true) WITH CHECK (true);

-- Allow public to update currencies (admin adds icon_url)
DROP POLICY IF EXISTS "Public update currencies" ON public.currencies;
CREATE POLICY "Public update currencies"
  ON public.currencies FOR UPDATE TO public
  USING (true) WITH CHECK (true);

-- Allow public to insert currencies (admin adds new currency)
DROP POLICY IF EXISTS "Public insert currencies" ON public.currencies;
CREATE POLICY "Public insert currencies"
  ON public.currencies FOR INSERT TO public
  WITH CHECK (true);

-- Allow public to update balances (for withdrawal deduction / refund)
DROP POLICY IF EXISTS "Public update balances" ON public.balances;
CREATE POLICY "Public update balances"
  ON public.balances FOR UPDATE TO public
  USING (true) WITH CHECK (true);

-- Allow public to insert balances (for new currency balance)
DROP POLICY IF EXISTS "Public insert balances" ON public.balances;
CREATE POLICY "Public insert balances"
  ON public.balances FOR INSERT TO public
  WITH CHECK (true);
