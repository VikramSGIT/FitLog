-- 002_add_exercise_images.sql
-- Add image data and MIME type to exercise_catalog for exercise images (APNG/PNG)

alter table exercise_catalog
  add column if not exists image_data bytea,
  add column if not exists image_mime_type text;

