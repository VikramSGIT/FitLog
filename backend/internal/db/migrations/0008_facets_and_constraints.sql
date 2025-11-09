-- Ensure facet reference tables exist
create table if not exists exercise_types (name text primary key);
create table if not exists body_parts (name text primary key);
create table if not exists equipment_types (name text primary key);
create table if not exists levels (name text primary key);

-- Ensure exercise_catalog has final columns
alter table exercise_catalog
  add column if not exists description text,
  add column if not exists type text,
  add column if not exists body_part text,
  add column if not exists equipment text,
  add column if not exists level text,
  add column if not exists links text[] default '{}'::text[];

-- Remove legacy columns if present
alter table exercise_catalog
  drop column if exists title,
  drop column if exists category;

-- Seed facet reference tables from existing catalog values before adding FKs
insert into exercise_types(name)
select distinct type from exercise_catalog where type is not null
on conflict do nothing;

insert into body_parts(name)
select distinct body_part from exercise_catalog where body_part is not null
on conflict do nothing;

insert into equipment_types(name)
select distinct equipment from exercise_catalog where equipment is not null
on conflict do nothing;

insert into levels(name)
select distinct level from exercise_catalog where level is not null
on conflict do nothing;

-- Add foreign key constraints for dropdown facets
alter table exercise_catalog
  add constraint exercise_catalog_type_fk foreign key (type) references exercise_types(name);
alter table exercise_catalog
  add constraint exercise_catalog_body_part_fk foreign key (body_part) references body_parts(name);
alter table exercise_catalog
  add constraint exercise_catalog_equipment_fk foreign key (equipment) references equipment_types(name);
alter table exercise_catalog
  add constraint exercise_catalog_level_fk foreign key (level) references levels(name);

-- Indexes to support search/filter (idempotent)
create index if not exists exercise_catalog_name_trgm_idx on exercise_catalog using gin (name gin_trgm_ops);
create index if not exists exercise_catalog_desc_trgm_idx on exercise_catalog using gin (description gin_trgm_ops);
create index if not exists exercise_catalog_type_idx on exercise_catalog (type);
create index if not exists exercise_catalog_body_part_idx on exercise_catalog (body_part);
create index if not exists exercise_catalog_equipment_idx on exercise_catalog (equipment);
create index if not exists exercise_catalog_level_idx on exercise_catalog (level);
create index if not exists exercise_catalog_secondary_muscles_gin_idx on exercise_catalog using gin (secondary_muscles);


