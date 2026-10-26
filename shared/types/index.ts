export type CategoryType = 'EXPENSE' | 'INCOME'
export type TxnType = 'INCOME' | 'EXPENSE'
export type Currency = 'ARS' | 'USD'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  name: string
  active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
}

export interface Transaction {
  id: string
  type: TxnType
  amount: number
  description: string | null
  date: string
  category_id: string | null
  category?: Pick<Category, 'id' | 'name' | 'color'> | null
}

export interface WorkEntry {
  id: string
  entry_date: string
  hours: number
  hourly_rate: number | null
  description: string | null
}

export interface BudgetItem {
  categoryId: string
  name: string
  color: string
  budgetId: string | null
  budget: number | null
  spent: number
}

export interface DashboardBudget {
  categoryId: string
  name: string
  color: string
  budget: number
  spent: number
  pct: number
}

export interface CategoryTotal {
  name: string
  color: string
  total: number
}

export interface DashboardData {
  income: number
  expense: number
  balance: number
  hours: number
  earnings: number
  budgets: DashboardBudget[]
  expensesByCategory: CategoryTotal[]
}
