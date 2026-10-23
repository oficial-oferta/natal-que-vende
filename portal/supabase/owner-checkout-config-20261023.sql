-- Store owner may connect only payment IDs and verified checkout URLs.
-- Product kind/title/slug/active remain immutable from browser.
grant update(cakto_product_id,checkout_url) on public.natal_offers to authenticated;
drop policy if exists "Only NQV owner connects Cakto offers" on public.natal_offers;
create policy "Only NQV owner connects Cakto offers" on public.natal_offers
for update to authenticated
using ((select public.is_nqv_admin()))
with check ((select public.is_nqv_admin()));
