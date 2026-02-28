-- Email reminder preferences (one row per reminder type per user)
create table if not exists public.user_email_preferences (
  id bigserial primary key,
  user_id text not null,
  reminder_type text not null,
  target_local_time text not null,
  timezone text not null,
  enabled boolean not null default true,
  last_sent_local_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_email_preferences_user_reminder_unique unique (user_id, reminder_type),
  constraint user_email_preferences_reminder_type_check check (reminder_type in ('wake', 'wind_down')),
  constraint user_email_preferences_time_format_check check (target_local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create index if not exists idx_user_email_preferences_user_id
  on public.user_email_preferences (user_id);

create index if not exists idx_user_email_preferences_enabled
  on public.user_email_preferences (enabled);

alter table public.user_email_preferences enable row level security;

drop policy if exists "user_email_preferences select own" on public.user_email_preferences;
create policy "user_email_preferences select own"
on public.user_email_preferences
for select
to authenticated
using ((auth.jwt()->>'sub') = user_id);

drop policy if exists "user_email_preferences insert own" on public.user_email_preferences;
create policy "user_email_preferences insert own"
on public.user_email_preferences
for insert
to authenticated
with check ((auth.jwt()->>'sub') = user_id);

drop policy if exists "user_email_preferences update own" on public.user_email_preferences;
create policy "user_email_preferences update own"
on public.user_email_preferences
for update
to authenticated
using ((auth.jwt()->>'sub') = user_id)
with check ((auth.jwt()->>'sub') = user_id);

drop policy if exists "user_email_preferences delete own" on public.user_email_preferences;
create policy "user_email_preferences delete own"
on public.user_email_preferences
for delete
to authenticated
using ((auth.jwt()->>'sub') = user_id);