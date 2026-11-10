-- =============================================================================
-- Fijos automáticos
--
-- Para quien solo planifica (no anota cada gasto): los débitos automáticos
-- (alquiler, servicios, sueldo) se registran solos en su fecha.
--
--   auto_register    → si se registra solo.
--   last_auto_month  → último mes ("YYYY-MM") en que se registró solo. Funciona
--                      como "lápida": si el usuario borra ese movimiento (ej. ese
--                      mes no se cobró), NO se vuelve a crear.
--
-- Migración NUEVA (no se edita la anterior): así se aplica igual en cualquier
-- base, esté o no la primera ya en producción.
-- =============================================================================

alter table public.recurring_items
  add column auto_register   boolean not null default false,
  add column last_auto_month text check (last_auto_month ~ '^\d{4}-\d{2}$');

comment on column public.recurring_items.auto_register is 'Se registra solo en su fecha (débito automático).';
comment on column public.recurring_items.last_auto_month is 'Último mes registrado automáticamente (evita recrear si el usuario lo borra).';

-- replace_my_data ahora también guarda las columnas nuevas.
create or replace function public.replace_my_data(p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  -- Borrado en orden inverso a las dependencias (FKs).
  delete from public.goal_movements  where user_id = v_uid;
  delete from public.savings_goals   where user_id = v_uid;
  delete from public.transactions    where user_id = v_uid;
  delete from public.recurring_items where user_id = v_uid;
  delete from public.categories      where user_id = v_uid;

  -- WITH ORDINALITY numera cada elemento: se usa para conservar el orden de las
  -- categorías (now() es igual para toda la transacción y empataría).
  insert into public.categories (user_id, id, name, icon, color, kind, monthly_limit, system, created_at)
  select v_uid, x.id, x.name, x.icon, x.color, x.kind, coalesce(x."monthlyLimit", 0), coalesce(x.system, false),
         now() + x.ord * interval '1 microsecond'
  from rows from (
         jsonb_to_recordset(coalesce(p_data -> 'categories', '[]'::jsonb))
           as (id text, name text, icon text, color text, kind text, "monthlyLimit" numeric, system boolean)
       ) with ordinality as x(id, name, icon, color, kind, "monthlyLimit", system, ord);

  insert into public.recurring_items (user_id, id, description, amount, type, category_id, day_of_month, active,
                                      auto_register, last_auto_month)
  select v_uid, x.id, x.description, x.amount, x.type, x."categoryId", x."dayOfMonth", coalesce(x.active, true),
         coalesce(x."autoRegister", false), x."lastAutoMonth"
  from jsonb_to_recordset(coalesce(p_data -> 'recurring', '[]'::jsonb))
    as x(id text, description text, amount numeric, type text, "categoryId" text, "dayOfMonth" smallint, active boolean,
         "autoRegister" boolean, "lastAutoMonth" text);

  insert into public.transactions (user_id, id, description, amount, type, category_id, date, recurring_id, created_at)
  select v_uid, x.id, x.description, x.amount, x.type, x."categoryId", x.date, x."recurringId",
         coalesce(to_timestamp(x."createdAt" / 1000.0), now())
  from jsonb_to_recordset(coalesce(p_data -> 'transactions', '[]'::jsonb))
    as x(id text, description text, amount numeric, type text, "categoryId" text, date date, "recurringId" text, "createdAt" bigint);

  insert into public.savings_goals (user_id, id, name, icon, color, target_amount, monthly_contribution, deadline, created_at)
  select v_uid, x.id, x.name, x.icon, x.color, x."targetAmount", coalesce(x."monthlyContribution", 0), x.deadline,
         coalesce(to_timestamp(x."createdAt" / 1000.0), now())
  from jsonb_to_recordset(coalesce(p_data -> 'goals', '[]'::jsonb))
    as x(id text, name text, icon text, color text, "targetAmount" numeric, "monthlyContribution" numeric, deadline date, "createdAt" bigint);

  insert into public.goal_movements (user_id, id, goal_id, amount, date)
  select v_uid, x.id, x."goalId", x.amount, x.date
  from jsonb_to_recordset(coalesce(p_data -> 'goalMovements', '[]'::jsonb))
    as x(id text, "goalId" text, amount numeric, date date);
end;
$$;
