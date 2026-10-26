import type { Currency } from './index'

export type AccountType = 'CASH' | 'BANK' | 'WALLET' | 'CREDIT_CARD' | 'OTHER'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'

export interface Account {
  id: string
  household_id: string
  name: string
  type: AccountType
  currency: Currency
  owner_id: string | null
  opening_balance: number
  active: boolean
  created_at: string
}

export interface HouseholdTask {
  id: string
  household_id: string
  title: string
  description: string | null
  category: string | null
  priority: TaskPriority
  status: TaskStatus
  responsible_member_id: string | null
  responsible_member?: { id: string; name: string } | null
  due_date: string | null
  estimated_cost: number | null
  actual_cost: number | null
  currency: Currency
  related_transaction_id: string | null
  created_at: string
  completed_at: string | null
  notes: string | null
}
