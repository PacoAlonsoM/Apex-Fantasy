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
