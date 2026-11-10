/**
 * Tipos de la base de datos, en el mismo formato que genera la CLI de Supabase.
 * Si cambiás el esquema, regeneralos con:
 *
 *   npx supabase gen types typescript --project-id <tu-project-ref> > src/lib/supabase/database.types.ts
 *
 * Los montos (`numeric`) llegan como `number` en JSON y las fechas (`date`)
 * como "YYYY-MM-DD".
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Owned = { user_id: string; created_at: string }

type Table<Row extends Owned> = {
  Row: Row
  // user_id y created_at tienen DEFAULT en la base: son opcionales al insertar.
  Insert: Omit<Row, "user_id" | "created_at"> & Partial<Owned>
  Update: Partial<Row>
  Relationships: []
}

export type CategoryRow = Owned & {
  id: string
  name: string
  icon: string
  color: string
  kind: string
  monthly_limit: number
  system: boolean
}

export type RecurringRow = Owned & {
  id: string
  description: string
  amount: number
  type: string
  category_id: string
  day_of_month: number
  active: boolean
  auto_register: boolean
  last_auto_month: string | null
}

export type TransactionRow = Owned & {
  id: string
  description: string
  amount: number
  type: string
  category_id: string
  date: string
  recurring_id: string | null
}

export type GoalRow = Owned & {
  id: string
  name: string
  icon: string
  color: string
  target_amount: number
  monthly_contribution: number
  deadline: string | null
}

export type GoalMovementRow = Owned & {
  id: string
  goal_id: string
  amount: number
  date: string
}

export type Database = {
  public: {
    Tables: {
      categories: Table<CategoryRow>
      recurring_items: Table<RecurringRow>
      transactions: Table<TransactionRow>
      savings_goals: Table<GoalRow>
      goal_movements: Table<GoalMovementRow>
    }
    Views: { [_ in never]: never }
    Functions: {
      delete_category: { Args: { p_id: string }; Returns: undefined }
      replace_my_data: { Args: { p_data: Json }; Returns: undefined }
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
