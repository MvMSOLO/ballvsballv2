-- Profile-frame entitlements are account-bound and server-controlled.
-- The ADMIN frame is a cosmetic badge, not an authorization role.
create table if not exists profile_badges (
  user_id text not null,
  badge_id text not null check (badge_id in ('vip', 'admin')),
  grant_source text not null check (grant_source in ('purchase')),
  created_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- A fixed claim key makes the Owner redeem code globally one-time.
-- Owner can also be granted automatically to the verified allowlisted email.
create table if not exists owner_badge_claims (
  claim_id text primary key,
  user_id text not null unique,
  created_at timestamptz not null default now()
);
