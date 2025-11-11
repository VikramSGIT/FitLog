-- Combined schema generated from migrations
-- This file captures the canonical schema state without data backfills.

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Epoch used to validate client save batches. Maintained per user.
alter table users add column if not exists save_epoch bigint not null default 0;

-- Reference tables
create table if not exists exercise_types (
  name text primary key
);

create table if not exists body_parts (
  name text primary key
);

create table if not exists equipment_types (
  name text primary key
);

create table if not exists levels (
  name text primary key
);

create table if not exists muscle_types (
  name text primary key
);

-- Catalog tables
create table if not exists exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext unique not null,
  description text null,
  type text not null references exercise_types(name),
  body_part text not null references body_parts(name),
  equipment text not null references equipment_types(name),
  level text not null references levels(name),
  links text[] not null default '{}'::text[],
  multiplier numeric(6,2) not null default 1,
  base_weight_kg numeric(6,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists exercise_catalog_lower_name_idx on exercise_catalog (lower(name));
create index if not exists exercise_catalog_name_trgm_idx on exercise_catalog using gin (name gin_trgm_ops);
create index if not exists exercise_catalog_desc_trgm_idx on exercise_catalog using gin (description gin_trgm_ops);
create index if not exists exercise_catalog_type_idx on exercise_catalog (type);
create index if not exists exercise_catalog_body_part_idx on exercise_catalog (body_part);
create index if not exists exercise_catalog_equipment_idx on exercise_catalog (equipment);
create index if not exists exercise_catalog_level_idx on exercise_catalog (level);

create table if not exists exercise_catalog_primary_muscles (
  catalog_id uuid not null references exercise_catalog(id) on delete cascade,
  muscle text not null references muscle_types(name),
  primary key (catalog_id, muscle)
);

create index if not exists exercise_catalog_primary_muscles_muscle_idx on exercise_catalog_primary_muscles (muscle);

create table if not exists exercise_catalog_secondary_muscles (
  catalog_id uuid not null references exercise_catalog(id) on delete cascade,
  muscle text not null references muscle_types(name),
  primary key (catalog_id, muscle)
);

create index if not exists exercise_catalog_secondary_muscles_muscle_idx on exercise_catalog_secondary_muscles (muscle);

-- Workout entities
create table if not exists workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workout_date date not null,
  timezone text null,
  notes text null,
  is_rest_day boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, workout_date)
);

create index if not exists workout_days_user_date_idx on workout_days (user_id, workout_date);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references workout_days(id) on delete cascade,
  catalog_id uuid not null references exercise_catalog(id) on delete cascade,
  name text not null,
  position int not null,
  comment text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists exercises_day_position_idx on exercises (day_id, position);
create index if not exists exercises_name_trgm_idx on exercises using gin (name gin_trgm_ops);
create index if not exists exercises_comment_trgm_idx on exercises using gin (comment gin_trgm_ops);

create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  user_id uuid not null,
  workout_date date not null,
  position int not null,
  reps int not null check (reps > 0),
  weight_kg numeric(6,2) not null check (weight_kg >= 0),
  rpe numeric(3,1) null check (rpe >= 0 and rpe <= 10),
  is_warmup boolean not null default false,
  rest_seconds int null check (rest_seconds >= 0),
  tempo text null,
  performed_at timestamptz null,
  volume_kg numeric generated always as (weight_kg * reps) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sets_exercise_position_idx on sets (exercise_id, position);
create index if not exists sets_user_date_idx on sets (user_id, workout_date);
create index if not exists sets_user_performed_idx on sets (user_id, performed_at);
create index if not exists sets_workout_date_idx on sets (workout_date);

create table if not exists rest_periods (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  position int not null check (position >= 0),
  duration_seconds int not null check (duration_seconds >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(exercise_id, position)
);

create index if not exists rest_periods_exercise_position_idx on rest_periods (exercise_id, position);

create table if not exists exercise_links (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references exercise_catalog(id) on delete cascade,
  source text not null,
  url text not null,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique(url),
  unique(catalog_id, url)
);

create index if not exists exercise_links_catalog_idx on exercise_links (catalog_id);

-- Functions
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function sync_sets_denorm() returns trigger as $$
declare
  d_user_id uuid;
  d_workout_date date;
begin
  select wd.user_id, wd.workout_date into d_user_id, d_workout_date
  from exercises e
  join workout_days wd on wd.id = e.day_id
  where e.id = new.exercise_id;

  new.user_id := d_user_id;
  new.workout_date := d_workout_date;
  return new;
end;
$$ language plpgsql;

create or replace function enforce_rest_day_without_exercises() returns trigger as $$
begin
  if new.is_rest_day then
    if exists (select 1 from exercises where day_id = new.id) then
      raise exception 'cannot mark rest day when exercises exist'
        using errcode = '23514', constraint = 'rest_day_requires_no_exercises';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function enforce_rest_day_on_exercises() returns trigger as $$
begin
  if exists (select 1 from workout_days where id = new.day_id and is_rest_day) then
    raise exception 'cannot add exercise to rest day'
      using errcode = '23514', constraint = 'exercises_require_training_day';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function set_exercise_name_from_catalog() returns trigger as $$
begin
  if new.catalog_id is null then
    raise exception 'catalog entry is required'
      using errcode = '23514', constraint = 'exercises_require_catalog';
  end if;
  select name into strict new.name from exercise_catalog where id = new.catalog_id;
  return new;
end;
$$ language plpgsql;

-- Triggers
create trigger trg_users_updated_at
before update on users
for each row execute procedure set_updated_at();

create trigger trg_workout_days_updated_at
before update on workout_days
for each row execute procedure set_updated_at();

create trigger trg_exercises_updated_at
before update on exercises
for each row execute procedure set_updated_at();

create trigger trg_sets_updated_at
before update on sets
for each row execute procedure set_updated_at();

create trigger trg_rest_periods_updated_at
before update on rest_periods
for each row execute procedure set_updated_at();

create trigger trg_sets_denorm_insert
before insert on sets
for each row execute procedure sync_sets_denorm();

create trigger trg_sets_denorm_update
before update of exercise_id on sets
for each row execute procedure sync_sets_denorm();

create trigger trg_workout_days_rest_check
before update of is_rest_day on workout_days
for each row execute procedure enforce_rest_day_without_exercises();

create trigger trg_exercises_rest_check
before insert or update on exercises
for each row execute procedure enforce_rest_day_on_exercises();

create trigger trg_exercises_catalog_name
before insert or update on exercises
for each row execute procedure set_exercise_name_from_catalog();

-- Materialized views
drop materialized view if exists set_facts;

create materialized view set_facts as
select
  s.id as set_id,
  s.user_id,
  d.workout_date,
  coalesce(ec.slug, lower(e.name)) as exercise_slug,
  e.name as exercise_name,
  e.comment as exercise_comment,
  s.reps,
  s.weight_kg,
  s.volume_kg,
  s.is_warmup,
  s.performed_at,
  extract(isodow from d.workout_date) as dow
from sets s
join exercises e on e.id = s.exercise_id
join workout_days d on d.id = e.day_id
left join exercise_catalog ec on ec.id = e.catalog_id
with no data;

create index if not exists set_facts_user_date_idx on set_facts (user_id, workout_date);
create index if not exists set_facts_slug_idx on set_facts (exercise_slug);
create index if not exists set_facts_workout_date_idx on set_facts (workout_date);
create index if not exists set_facts_workout_date_brin on set_facts using brin (workout_date);

