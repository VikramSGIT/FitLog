alter table workout_days
  add column if not exists is_rest_day boolean not null default false;

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

drop trigger if exists trg_workout_days_rest_check on workout_days;
create trigger trg_workout_days_rest_check
before update of is_rest_day on workout_days
for each row execute procedure enforce_rest_day_without_exercises();

create or replace function enforce_rest_day_on_exercises() returns trigger as $$
begin
  if exists (select 1 from workout_days where id = new.day_id and is_rest_day) then
    raise exception 'cannot add exercise to rest day'
      using errcode = '23514', constraint = 'exercises_require_training_day';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_exercises_rest_check on exercises;
create trigger trg_exercises_rest_check
before insert or update on exercises
for each row execute procedure enforce_rest_day_on_exercises();

