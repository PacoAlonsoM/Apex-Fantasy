alter table public.profiles
  add column if not exists avatar_color text;

update public.profiles
set username = 'player_' || substr(replace(id::text, '-', ''), 1, 8)
where username is null or btrim(username) = '';

with ranked as (
  select
    id,
    username,
    row_number() over (
      partition by lower(username)
      order by id
    ) as rn
  from public.profiles
)
update public.profiles p
set username = left(r.username || '_' || substr(replace(p.id::text, '-', ''), 1, 4), 24)
from ranked r
where p.id = r.id
  and r.rn > 1;

update public.profiles
set avatar_color = 'ember'
where avatar_color is null or btrim(avatar_color) = '';

alter table public.profiles
  alter column avatar_color set default 'ember';

alter table public.profiles
  alter column avatar_color set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_color_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_color_check
      check (avatar_color in ('ember', 'ocean', 'teal', 'steel', 'gold', 'violet'));
  end if;
end $$;

create unique index if not exists profiles_username_lower_unique
  on public.profiles ((lower(username)));
