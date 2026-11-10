/**
 * Tests de la base de datos (esquema + RLS + funciones), sin Docker.
 *
 * Usa PGlite (Postgres real compilado a WebAssembly) y simula lo mínimo de
 * Supabase: el esquema `auth` con `auth.users` y `auth.uid()`, y los roles
 * `anon` / `authenticated`. Así verificamos que un usuario NO puede ver ni
 * tocar datos de otro, que es la garantía central de la app.
 *
 *   npm run test:db
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { before, describe, it } from "node:test"

import { PGlite } from "@electric-sql/pglite"

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations")
const ALICE = "11111111-1111-1111-1111-111111111111"
const BOB = "22222222-2222-2222-2222-222222222222"

/** Lo mínimo de Supabase que la migración necesita para correr. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  -- Igual que en Supabase: el id del usuario sale del JWT de la request.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`

let db

/** Ejecuta `fn` como un usuario autenticado (o como anónimo si uid es null). */
async function as(uid, fn) {
  await db.exec(`
    set role ${uid ? "authenticated" : "anon"};
    select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
  `)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

const rows = async (sql, params) => (await db.query(sql, params)).rows

const seedCategory = (id, kind = "expense", system = false) =>
  db.query(
    `insert into public.categories (id, name, icon, color, kind, system) values ($1, $1, 'package', 'blue', $2, $3)`,
    [id, kind, system]
  )

before(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
  }
  await db.query(`insert into auth.users (id, email) values ($1, 'alice@test.com'), ($2, 'bob@test.com')`, [ALICE, BOB])

  // Datos iniciales de Alice: categorías de sistema + una propia + un movimiento.
  await as(ALICE, async () => {
    await seedCategory("otros", "expense", true)
    await seedCategory("otros-ingresos", "income", true)
    await seedCategory("ocio")
    await db.query(
      `insert into public.transactions (id, description, amount, type, category_id, date)
       values ('t1', 'Cine', 1500, 'expense', 'ocio', '2026-11-01')`
    )
  })
})

describe("RLS: aislamiento entre usuarios", () => {
  it("Alice ve sus propias filas (user_id se completa solo con auth.uid())", async () => {
    const result = await as(ALICE, () => rows(`select id, user_id from public.categories order by id`))
    assert.equal(result.length, 3)
    assert.ok(result.every((r) => r.user_id === ALICE))
  })

  it("Bob NO ve las filas de Alice", async () => {
    const cats = await as(BOB, () => rows(`select * from public.categories`))
    const txs = await as(BOB, () => rows(`select * from public.transactions`))
    assert.equal(cats.length, 0)
    assert.equal(txs.length, 0)
  })

  it("Bob NO puede modificar ni borrar filas de Alice (afecta 0 filas)", async () => {
    const updated = await as(BOB, () => db.query(`update public.transactions set amount = 1 where id = 't1'`))
    const deleted = await as(BOB, () => db.query(`delete from public.transactions where id = 't1'`))
    assert.equal(updated.affectedRows, 0)
    assert.equal(deleted.affectedRows, 0)
    const [tx] = await as(ALICE, () => rows(`select amount from public.transactions where id = 't1'`))
    assert.equal(Number(tx.amount), 1500)
  })

  it("Bob NO puede insertar filas a nombre de Alice", async () => {
    await assert.rejects(
      as(BOB, () =>
        db.query(
          `insert into public.categories (user_id, id, name, icon, color, kind) values ($1, 'x', 'x', 'x', 'blue', 'expense')`,
          [ALICE]
        )
      ),
      /row-level security/
    )
  })

  it("Un visitante anónimo no tiene acceso a las tablas", async () => {
    await assert.rejects(as(null, () => rows(`select * from public.transactions`)), /permission denied/)
  })

  it("Bob no puede usar una categoría de Alice en sus movimientos (FK compuesta)", async () => {
    await assert.rejects(
      as(BOB, () =>
        db.query(
          `insert into public.transactions (id, description, amount, type, category_id, date)
           values ('tb', 'x', 10, 'expense', 'ocio', '2026-11-01')`
        )
      ),
      /foreign key/
    )
  })
})

describe("Validaciones (CHECK)", () => {
  it("rechaza montos negativos, colores inválidos y días fuera de rango", async () => {
    await as(ALICE, async () => {
      await assert.rejects(
        db.query(`insert into public.transactions (id, description, amount, type, category_id, date) values ('n', 'x', -5, 'expense', 'ocio', '2026-11-01')`),
        /check constraint/
      )
      await assert.rejects(
        db.query(`insert into public.categories (id, name, icon, color, kind) values ('c', 'c', 'x', 'fucsia', 'expense')`),
        /check constraint/
      )
      await assert.rejects(
        db.query(`insert into public.recurring_items (id, description, amount, type, category_id, day_of_month) values ('r', 'x', 10, 'expense', 'ocio', 32)`),
        /check constraint/
      )
    })
  })
})

describe("Funciones RPC", () => {
  it("delete_category mueve los movimientos a 'otros' y borra la categoría", async () => {
    await as(ALICE, async () => {
      await db.query(`select public.delete_category('ocio')`)
      const [tx] = await rows(`select category_id from public.transactions where id = 't1'`)
      assert.equal(tx.category_id, "otros")
      assert.equal((await rows(`select 1 from public.categories where id = 'ocio'`)).length, 0)
    })
  })

  it("delete_category no permite borrar categorías del sistema", async () => {
    await assert.rejects(as(ALICE, () => db.query(`select public.delete_category('otros')`)), /sistema/)
  })

  it("replace_my_data reemplaza todo de forma atómica y solo para quien llama", async () => {
    const data = {
      categories: [
        { id: "sueldo", name: "Sueldo", icon: "briefcase", color: "violet", kind: "income", monthlyLimit: 0 },
        { id: "otros", name: "Otros", icon: "package", color: "red", kind: "expense", monthlyLimit: 100, system: true },
      ],
      recurring: [
        { id: "r1", description: "Sueldo", amount: 1000, type: "income", categoryId: "sueldo", dayOfMonth: 1, active: true, autoRegister: true, lastAutoMonth: "2026-11" },
      ],
      transactions: [
        { id: "x1", description: "Sueldo", amount: 1000, type: "income", categoryId: "sueldo", date: "2026-11-01", recurringId: "r1", createdAt: 1762000000000 },
      ],
      goals: [{ id: "g1", name: "Viaje", icon: "plane", color: "orange", targetAmount: 5000, monthlyContribution: 500, deadline: null, createdAt: 1762000000000 }],
      goalMovements: [{ id: "m1", goalId: "g1", amount: 700, date: "2026-11-02" }],
    }
    await as(BOB, () => db.query(`select public.replace_my_data($1::jsonb)`, [JSON.stringify(data)]))

    const bob = await as(BOB, async () => ({
      categories: (await rows(`select id from public.categories`)).length,
      transactions: await rows(`select recurring_id, created_at from public.transactions`),
      saved: (await rows(`select sum(amount)::float as s from public.goal_movements`))[0].s,
    }))
    assert.equal(bob.categories, 2)
    assert.equal(bob.transactions[0].recurring_id, "r1")
    assert.equal(new Date(bob.transactions[0].created_at).getTime(), 1762000000000)
    assert.equal(bob.saved, 700)

    // Las columnas de fijos automáticos (migración 2) también se guardan.
    const [fixed] = await as(BOB, () => rows(`select auto_register, last_auto_month from public.recurring_items`))
    assert.deepEqual(fixed, { auto_register: true, last_auto_month: "2026-11" })

    // El orden de las categorías del JSON se conserva (alfabéticamente sería al revés).
    const order = await as(BOB, () => rows(`select id from public.categories order by created_at, id`))
    assert.deepEqual(order.map((r) => r.id), ["sueldo", "otros"])

    // Los datos de Alice siguen intactos.
    const alice = await as(ALICE, () => rows(`select id from public.transactions`))
    assert.deepEqual(alice.map((r) => r.id), ["t1"])
  })

  it("replace_my_data es atómico: si algo falla, no se borra nada", async () => {
    const invalid = { categories: [{ id: "otros", name: "Otros", icon: "x", color: "NO-EXISTE", kind: "expense" }] }
    await assert.rejects(as(BOB, () => db.query(`select public.replace_my_data($1::jsonb)`, [JSON.stringify(invalid)])))
    const remaining = await as(BOB, () => rows(`select id from public.categories`))
    assert.equal(remaining.length, 2, "los datos previos de Bob deben seguir ahí")
  })

  it("migración 2: los fijos son manuales por defecto y last_auto_month valida el formato", async () => {
    await as(ALICE, async () => {
      await db.query(`insert into public.recurring_items (id, description, amount, type, category_id, day_of_month) values ('rx', 'Luz', 10, 'expense', 'otros', 15)`)
      const [r] = await rows(`select auto_register, last_auto_month from public.recurring_items where id = 'rx'`)
      assert.deepEqual(r, { auto_register: false, last_auto_month: null })
      await assert.rejects(db.query(`update public.recurring_items set last_auto_month = 'noviembre' where id = 'rx'`), /check constraint/)
    })
  })

  it("los anónimos no pueden ejecutar las funciones", async () => {
    await assert.rejects(as(null, () => db.query(`select public.replace_my_data('{}'::jsonb)`)), /permission denied/)
  })

  it("delete_my_account borra al usuario y todos sus datos (cascade), sin tocar a otros", async () => {
    await as(BOB, () => db.query(`select public.delete_my_account()`))
    const users = await rows(`select id from auth.users order by id`)
    assert.deepEqual(users.map((u) => u.id), [ALICE])
    const orphan = await rows(`select count(*)::int as n from public.goal_movements where user_id = $1`, [BOB])
    assert.equal(orphan[0].n, 0)
    const alice = await as(ALICE, () => rows(`select id from public.transactions`))
    assert.equal(alice.length, 1)
  })
})
