-- =============================================================================
-- Plan Financiero · Esquema inicial
--
-- Conceptos clave:
--   * Cada fila pertenece a un usuario (columna user_id → auth.users).
--   * RLS (Row Level Security) garantiza que cada usuario solo vea y modifique
--     SUS filas, aunque el navegador hable directo con la base de datos.
--   * Clave primaria compuesta (user_id, id): los ids los genera la app y solo
--     tienen que ser únicos dentro de cada usuario (ej. la categoría "otros").
--   * Los CHECK replican las validaciones de la UI: la base es la última
--     línea de defensa ante datos inválidos.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

create table public.categories (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id            text        not null check (char_length(id) between 1 and 64),
  name          text        not null check (char_length(name) between 1 and 30),
  icon          text        not null check (char_length(icon) between 1 and 32),
  color         text        not null check (color in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red')),
  kind          text        not null check (kind in ('income', 'expense')),
  monthly_limit numeric(14, 2) not null default 0 check (monthly_limit >= 0),
  system        boolean     not null default false,
  created_at    timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table public.categories is 'Categorías de ingreso/gasto. monthly_limit = tope mensual (0 = sin límite).';

create table public.recurring_items (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id           text        not null check (char_length(id) between 1 and 64),
  description  text        not null check (char_length(description) between 1 and 60),
  amount       numeric(14, 2) not null check (amount > 0),
  type         text        not null check (type in ('income', 'expense')),
  category_id  text        not null,
  day_of_month smallint    not null check (day_of_month between 1 and 31),
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  primary key (user_id, id),
  -- FK compuesta: la categoría debe existir y ser DEL MISMO usuario.
  foreign key (user_id, category_id) references public.categories (user_id, id)
);
comment on table public.recurring_items is 'Gastos/ingresos fijos mensuales que se proyectan hasta registrarse.';

create table public.transactions (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id           text        not null check (char_length(id) between 1 and 64),
  description  text        not null check (char_length(description) between 1 and 60),
  amount       numeric(14, 2) not null check (amount > 0),
  type         text        not null check (type in ('income', 'expense')),
  category_id  text        not null,
  date         date        not null,
  -- Sin FK a propósito: si se borra un fijo, sus pagos históricos se conservan.
  recurring_id text,
  created_at   timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
);
comment on table public.transactions is 'Movimientos reales (lo que efectivamente se gastó o cobró).';

create table public.savings_goals (
  user_id              uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                   text        not null check (char_length(id) between 1 and 64),
  name                 text        not null check (char_length(name) between 1 and 40),
  icon                 text        not null check (char_length(icon) between 1 and 32),
  color                text        not null check (color in ('blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red')),
  target_amount        numeric(14, 2) not null check (target_amount > 0),
  monthly_contribution numeric(14, 2) not null default 0 check (monthly_contribution >= 0),
  deadline             date,
  created_at           timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table public.savings_goals is 'Metas de ahorro con aporte mensual planificado.';

create table public.goal_movements (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 64),
  goal_id    text        not null,
  amount     numeric(14, 2) not null check (amount <> 0), -- + abono / − retiro
  date       date        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  -- Al borrar una meta se borran sus movimientos.
  foreign key (user_id, goal_id) references public.savings_goals (user_id, id) on delete cascade
);
comment on table public.goal_movements is 'Abonos y retiros de fondos de cada meta.';

-- Índices para las consultas más frecuentes (por usuario y fecha).
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index goal_movements_user_goal_idx on public.goal_movements (user_id, goal_id);
-- Índices que respaldan las FKs compuestas (Postgres no los crea solo).
create index transactions_category_idx on public.transactions (user_id, category_id);
create index recurring_items_category_idx on public.recurring_items (user_id, category_id);


-- -----------------------------------------------------------------------------
-- 2. Seguridad a nivel de fila (RLS)
--
-- Sin políticas, RLS bloquea TODO. Cada política abre exactamente lo necesario:
-- un usuario autenticado puede operar solo sobre filas con su propio user_id.
-- `(select auth.uid())` se evalúa una sola vez por consulta (más eficiente
-- que `auth.uid()` fila por fila).
-- -----------------------------------------------------------------------------

alter table public.categories      enable row level security;
alter table public.recurring_items enable row level security;
alter table public.transactions    enable row level security;
alter table public.savings_goals   enable row level security;
alter table public.goal_movements  enable row level security;

create policy "Cada usuario gestiona sus categorías" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Cada usuario gestiona sus fijos" on public.recurring_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Cada usuario gestiona sus movimientos" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Cada usuario gestiona sus metas" on public.savings_goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Cada usuario gestiona los movimientos de sus metas" on public.goal_movements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Permisos explícitos: los visitantes anónimos (rol `anon`) no tocan nada.
revoke all on public.categories, public.recurring_items, public.transactions,
              public.savings_goals, public.goal_movements from anon;
grant select, insert, update, delete on public.categories, public.recurring_items,
              public.transactions, public.savings_goals, public.goal_movements to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Funciones (RPC) — operaciones de varios pasos que deben ser ATÓMICAS
--
-- `security invoker`: corren con los permisos de quien llama, así que RLS
-- sigue aplicando. `set search_path = ''` evita ataques por suplantación de
-- objetos (por eso todo va calificado con `public.`).
-- -----------------------------------------------------------------------------

-- Borra una categoría moviendo sus movimientos y fijos a "Otros" (de su tipo).
create function public.delete_category(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_kind     text;
  v_system   boolean;
  v_fallback text;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  select kind, system into v_kind, v_system
  from public.categories
  where user_id = v_uid and id = p_id;

  if not found then
    return; -- nada que borrar (idempotente)
  end if;
  if v_system then
    raise exception 'Las categorías del sistema no se pueden eliminar' using errcode = '42501';
  end if;

  v_fallback := case v_kind when 'income' then 'otros-ingresos' else 'otros' end;

  update public.transactions    set category_id = v_fallback where user_id = v_uid and category_id = p_id;
  update public.recurring_items set category_id = v_fallback where user_id = v_uid and category_id = p_id;
  delete from public.categories where user_id = v_uid and id = p_id;
end;
$$;

-- Reemplaza TODOS los datos del usuario por los recibidos (JSON con la forma de
-- FinanceState de la app). Se usa para: datos de ejemplo, empezar de cero e
-- importar datos locales. Todo ocurre en una única transacción.
create function public.replace_my_data(p_data jsonb)
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

  insert into public.recurring_items (user_id, id, description, amount, type, category_id, day_of_month, active)
  select v_uid, x.id, x.description, x.amount, x.type, x."categoryId", x."dayOfMonth", coalesce(x.active, true)
  from jsonb_to_recordset(coalesce(p_data -> 'recurring', '[]'::jsonb))
    as x(id text, description text, amount numeric, type text, "categoryId" text, "dayOfMonth" smallint, active boolean);

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

-- Elimina la cuenta del usuario que llama (derecho de supresión).
-- Necesita `security definer` (permisos del dueño) porque un usuario común no
-- puede borrar en auth.users; por eso solo borra la fila de auth.uid().
-- Los datos de las tablas públicas se van solos por `on delete cascade`.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- Las funciones son ejecutables por PUBLIC por defecto: lo restringimos.
revoke execute on function public.delete_category(text)  from public, anon;
revoke execute on function public.replace_my_data(jsonb) from public, anon;
revoke execute on function public.delete_my_account()    from public, anon;
grant  execute on function public.delete_category(text)  to authenticated;
grant  execute on function public.replace_my_data(jsonb) to authenticated;
grant  execute on function public.delete_my_account()    to authenticated;
