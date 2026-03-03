alter table public.profiles
  add column if not exists avatar_color text,
  add column if not exists favorite_team text,
  add column if not exists favorite_driver text;

update public.profiles
set avatar_color = 'ember'
where avatar_color is null or btrim(avatar_color) = '';

alter table public.profiles
  alter column avatar_color set default 'ember';

alter table public.profiles
  alter column avatar_color set not null;

alter table public.profiles
  drop constraint if exists profiles_avatar_color_check;

alter table public.profiles
  add constraint profiles_avatar_color_check
  check (
    avatar_color in (
      'ember',
      'ocean',
      'teal',
      'steel',
      'gold',
      'violet',
      'support-mclaren',
      'support-ferrari',
      'support-mercedes',
      'support-red-bull',
      'support-aston',
      'support-alpine',
      'support-haas',
      'support-rb',
      'support-williams',
      'support-audi',
      'support-cadillac'
    )
  );

update public.profiles
set favorite_team = case avatar_color
  when 'support-mclaren' then 'McLaren'
  when 'support-ferrari' then 'Ferrari'
  when 'support-mercedes' then 'Mercedes'
  when 'support-red-bull' then 'Red Bull Racing'
  when 'support-aston' then 'Aston Martin'
  when 'support-alpine' then 'Alpine'
  when 'support-haas' then 'Haas'
  when 'support-rb' then 'Racing Bulls'
  when 'support-williams' then 'Williams'
  when 'support-audi' then 'Audi'
  when 'support-cadillac' then 'Cadillac'
  else favorite_team
end
where favorite_team is null;
