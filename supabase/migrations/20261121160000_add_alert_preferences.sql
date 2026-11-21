alter table public.notification_settings
  add column if not exists enabled boolean not null default true,
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists ending_hours integer not null default 6
    check (ending_hours between 1 and 24);
