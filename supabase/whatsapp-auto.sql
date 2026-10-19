-- BOOMiiS: automatic WhatsApp messages (OPTIONAL).
-- Run this ONLY after the "order-whatsapp" Edge Function is deployed and Meta is set up
-- (see HANDOVER.md → "Automatic WhatsApp messages"). Safe to run more than once.
--
-- Before running, store the two secrets in the vault (replace the key with your HOOK_SECRET):
--   select vault.create_secret('https://qmqwnolgcvvgdjugnqqd.supabase.co/functions/v1/order-whatsapp', 'whatsapp_fn_url');
--   select vault.create_secret('PASTE-THE-SAME-LONG-RANDOM-HOOK_SECRET', 'whatsapp_fn_key');

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_order_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'whatsapp_fn_url' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'whatsapp_fn_key' limit 1;
  if v_url is null or v_key is null then
    return new;   -- not configured yet: do nothing
  end if;
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('ref', new.ref, 'name', new.customer_name, 'phone', new.customer_phone,
                                  'status', new.status, 'mode', new.mode, 'total', new.total),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-boomiis-key', v_key),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;     -- a message problem must never block an order
end;
$$;
revoke all on function public.notify_order_whatsapp() from public, anon, authenticated;

drop trigger if exists orders_whatsapp on public.orders;
create trigger orders_whatsapp
  after insert or update of status on public.orders
  for each row execute function public.notify_order_whatsapp();

-- To switch automatic messages OFF again:
--   drop trigger if exists orders_whatsapp on public.orders;
