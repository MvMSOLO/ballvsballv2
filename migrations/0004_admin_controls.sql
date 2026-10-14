-- Owner-only moderation and game economy overrides.
-- Authorization is enforced in server functions; these tables never store client-trusted roles.
create table if not exists player_admin_controls (
  user_id text primary key references "user" ("id") on delete cascade,
  is_banned boolean not null default false,
  ban_reason text not null default '',
  infinite_coins boolean not null default false,
  infinite_diamonds boolean not null default false,
  coins_before_infinite integer,
  diamonds_before_infinite integer,
  kicked_at timestamptz,
  kicked_by text references "user" ("id") on delete set null,
  banned_at timestamptz,
  banned_by text references "user" ("id") on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_action_log (
  id text primary key,
  actor_user_id text references "user" ("id") on delete set null,
  target_user_id text references "user" ("id") on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_action_log_created_idx on admin_action_log (created_at desc);
create index if not exists player_admin_controls_banned_idx on player_admin_controls (is_banned) where is_banned;

-- Frames granted by the owner are distinct from frames bought with gems.
alter table profile_badges drop constraint if exists profile_badges_grant_source_check;
alter table profile_badges add constraint profile_badges_grant_source_check
  check (grant_source in ('purchase', 'admin'));
