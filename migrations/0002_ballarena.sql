create table if not exists profiles (
  user_id text primary key,
  username text unique,
  country text not null default 'UZ',
  title text not null default 'Rookie',
  trophies integer not null default 0,
  level integer not null default 1,
  favorite text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists saves (
  user_id text primary key,
  version integer not null,
  blob text not null,
  coins integer not null default 0,
  diamonds integer not null default 0,
  xp integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists matches (
  id text primary key,
  user_id text not null,
  seed integer not null,
  win boolean not null,
  opponent text not null,
  ball text not null,
  trophies integer not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now()
);
create index if not exists matches_user_idx on matches (user_id, created_at desc);

create table if not exists leaderboard (
  user_id text primary key,
  username text not null,
  country text not null,
  trophies integer not null default 0,
  favorite text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists leaderboard_trophies_idx on leaderboard (trophies desc);
create index if not exists leaderboard_country_idx on leaderboard (country, trophies desc);

create table if not exists orders (
  id text primary key,
  user_id text not null,
  sku text not null,
  status text not null,
  created_at timestamptz not null default now()
);
create index if not exists orders_user_idx on orders (user_id);

create table if not exists friends (
  user_id text not null,
  friend_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_name)
);

create table if not exists claims (
  user_id text not null,
  claim_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_key)
);
