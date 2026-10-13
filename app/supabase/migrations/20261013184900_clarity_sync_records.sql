-- Applied to the Clarity sync project (ca-central-1) on 13 October 2026.
-- One row per synced item, per user. Clarity stays local-first: this table is
-- a meeting point between a person's devices, not the source of truth.
create table public.records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('task', 'thread', 'profile', 'insight', 'journal')),
  id         text        not null check (char_length(id) between 1 and 200),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,                      -- when the device made the change
  device     text        check (device is null or char_length(device) <= 100),
  synced_at  timestamptz not null default clock_timestamp(),  -- server cursor for pulls
  primary key (user_id, kind, id),
  constraint records_data_size check (data is null or pg_column_size(data) < 1048576),
  constraint records_tombstone check (not deleted or data is null)
);

create index records_user_synced_idx on public.records (user_id, synced_at);

comment on table public.records is
  'Clarity sync: one row per task/thread/profile/insight/journal entry per user. Newest updated_at wins; deletions are tombstones.';

-- The server stamps the pull cursor itself (device clocks drift), and an older
-- edit never overwrites a newer one: that is the whole conflict rule.
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot change';
    end if;
    if new.updated_at < old.updated_at then
      return null;   -- older edit: keep what is there
    end if;
  end if;
  return new;
end;
$$;

create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();

alter table public.records enable row level security;

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

create policy "records: read own"   on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy "records: insert own" on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records: update own" on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records: delete own" on public.records for delete to authenticated using ((select auth.uid()) = user_id);
