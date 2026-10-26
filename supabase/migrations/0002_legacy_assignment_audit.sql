-- Control Hogar 2.0 - legacy assignment audit
-- This migration creates only an audit registry. It does not assign or update
-- any row in categories, transactions, budgets or work_entries.

create table if not exists public.legacy_record_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  source_table text not null check (source_table in ('categories', 'transactions', 'budgets', 'work_entries')),
  record_id uuid not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assignment_reason text not null,
  assigned_at timestamptz not null default now(),
  unique (source_table, record_id)
);

create index if not exists legacy_record_assignments_household_idx
  on public.legacy_record_assignments (household_id, assigned_at desc);

alter table public.legacy_record_assignments enable row level security;
drop policy if exists household_access on public.legacy_record_assignments;
create policy household_access on public.legacy_record_assignments
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and assigned_by = auth.uid()
  );

comment on table public.legacy_record_assignments is
  'Audit registry for explicit legacy household assignments; it never performs the assignment itself.';

-- Application procedure, intentionally not executed by this migration:
-- 1. Select the target household and review every legacy record.
-- 2. Insert one audit row per approved record with the authenticated user.
-- 3. In the same transaction, update only the approved nullable household_id.
-- 4. Verify counts and financial totals before COMMIT.
-- 5. Never infer household, member, account, currency or category from amount.
