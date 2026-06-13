-- Distinguish regular clients from one-off (occasional) buyers.
-- Occasional clients (is_regular = false) keep a real id — so their debts
-- are tracked and paid down exactly like regulars — but are kept out of the
-- main contacts list. Promote to regular by flipping the flag (history preserved).
alter table public.clients add column is_regular boolean not null default false;

-- Existing clients were only ever created via the explicit "add client" action,
-- so treat them all as regulars.
update public.clients set is_regular = true;
