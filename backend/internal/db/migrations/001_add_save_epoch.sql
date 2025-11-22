-- 001_add_save_epoch.sql
-- Add save_epoch column to users table for tracking save batch epochs

alter table users add column if not exists save_epoch bigint not null default 0;

