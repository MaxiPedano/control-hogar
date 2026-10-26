-- Control Hogar 2.0 - foundation
-- Non-destructive migration. Review against the remote schema before applying.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members (user_id, active);

alter table public.categories add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.transactions add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.transactions add column if not exists member_id uuid references public.household_members(id) on delete set null;
alter table public.transactions add column if not exists account_id uuid;
alter table public.transactions add column if not exists payment_method text;
-- Keep legacy rows untouched: these metadata fields remain nullable until an
-- explicit historical-assignment decision is made.
alter table public.transactions add column if not exists status text;
alter table public.transactions add column if not exists due_date date;
alter table public.transactions add column if not exists paid_at timestamptz;
alter table public.transactions add column if not exists currency text;
alter table public.transactions add column if not exists source text;
alter table public.transactions add column if not exists external_reference text;
alter table public.transactions add column if not exists notes text;
alter table public.budgets add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.budgets add column if not exists currency text;
alter table public.work_entries add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.work_entries add column if not exists member_id uuid references public.household_members(id) on delete set null;

do $$ begin
  alter table public.transactions add constraint transactions_status_check
    check (status in ('PLANNED', 'PENDING', 'PAID', 'CANCELLED'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.transactions add constraint transactions_currency_check
    check (currency in ('ARS', 'USD'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.budgets add constraint budgets_currency_check
    check (currency in ('ARS', 'USD'));
exception when duplicate_object then null; end $$;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  type text not null check (type in ('CASH', 'BANK', 'WALLET', 'CREDIT_CARD', 'OTHER')),
  currency text not null check (currency in ('ARS', 'USD')),
  owner_id uuid references public.household_members(id) on delete set null,
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.transactions add constraint transactions_account_fk
  foreign key (account_id) references public.accounts(id) on delete set null;

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  creditor text not null,
  description text,
  original_amount numeric(14,2),
  outstanding_amount numeric(14,2),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  due_date date,
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED')),
  amount_confirmed boolean not null default false,
  responsible_member_id uuid references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  notes text,
  check (original_amount is null or original_amount > 0),
  check (outstanding_amount is null or outstanding_amount >= 0)
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_obligations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  frequency text not null check (frequency in ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  due_day smallint check (due_day between 1 and 31),
  expected_amount numeric(14,2) check (expected_amount is null or expected_amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  responsible_member_id uuid references public.household_members(id) on delete set null,
  active boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'CANCELLED')),
  created_at timestamptz not null default now(),
  notes text
);

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('WEEKLY', 'MONTHLY', 'OCCASIONAL')),
  expected_amount numeric(14,2) check (expected_amount is null or expected_amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  start_date date,
  end_date date,
  status text not null default 'EXPECTED' check (status in ('EXPECTED', 'RECEIVED', 'CANCELLED')),
  responsible_member_id uuid references public.household_members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null unique references public.accounts(id) on delete restrict,
  issuer text,
  last_four text,
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.card_statements (
  id uuid primary key default gen_random_uuid(),
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  currency text not null check (currency in ('ARS', 'USD')),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'PAID', 'CANCELLED')),
  unique (credit_card_id, period_start, period_end),
  check (period_end >= period_start)
);

create table if not exists public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  statement_id uuid references public.card_statements(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  description text not null,
  purchase_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  installments smallint not null default 1 check (installments > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.card_installments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.card_purchases(id) on delete cascade,
  installment_number smallint not null check (installment_number > 0),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'PLANNED' check (status in ('PLANNED', 'BILLED', 'PAID', 'CANCELLED')),
  unique (purchase_id, installment_number)
);

create table if not exists public.card_payments (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.card_statements(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.household_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  category text,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  responsible_member_id uuid references public.household_members(id) on delete set null,
  due_date date,
  estimated_cost numeric(14,2) check (estimated_cost is null or estimated_cost >= 0),
  actual_cost numeric(14,2) check (actual_cost is null or actual_cost >= 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  related_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.household_tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.household_tasks(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  event_type text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  status text not null default 'DISCONNECTED' check (status in ('DISCONNECTED', 'PAIRING', 'CONNECTED', 'ERROR')),
  connected_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  whatsapp_group_id text not null,
  name text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (connection_id, whatsapp_group_id)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  group_id uuid not null references public.whatsapp_groups(id) on delete cascade,
  whatsapp_message_id text not null,
  sender_id text not null,
  sender_name text,
  message_timestamp timestamptz not null,
  message_type text not null,
  content text,
  processing_status text not null default 'RECEIVED' check (processing_status in ('RECEIVED', 'PROCESSED', 'ERROR', 'IGNORED')),
  created_at timestamptz not null default now(),
  unique (group_id, whatsapp_message_id)
);

create table if not exists public.whatsapp_extractions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.whatsapp_messages(id) on delete cascade,
  detected_type text not null check (detected_type in ('EXPENSE', 'INCOME', 'DEBT_PAYMENT', 'OBLIGATION', 'TASK', 'QUERY', 'NON_FINANCIAL', 'AMBIGUOUS')),
  amount numeric(14,2) check (amount is null or amount > 0),
  currency text check (currency is null or currency in ('ARS', 'USD')),
  description text,
  transaction_date date,
  suggested_category_id uuid references public.categories(id) on delete set null,
  suggested_member_id uuid references public.household_members(id) on delete set null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  validation_status text not null default 'PENDING_REVIEW' check (validation_status in ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'DUPLICATE')),
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  linked_task_id uuid references public.household_tasks(id) on delete set null,
  notes text
);

create index if not exists transactions_household_date_idx on public.transactions (household_id, date);
create index if not exists tasks_household_status_idx on public.household_tasks (household_id, status, due_date);
create index if not exists whatsapp_messages_household_timestamp_idx on public.whatsapp_messages (household_id, message_timestamp desc);
create index if not exists whatsapp_extractions_review_idx on public.whatsapp_extractions (validation_status);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and active = true
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.recurring_obligations enable row level security;
alter table public.income_sources enable row level security;
alter table public.credit_cards enable row level security;
alter table public.card_statements enable row level security;
alter table public.card_purchases enable row level security;
alter table public.card_installments enable row level security;
alter table public.card_payments enable row level security;
alter table public.household_tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_history enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_groups enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_extractions enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.work_entries enable row level security;

-- Policies are intentionally scoped to active household membership. Legacy
-- rows with a NULL household_id remain preserved but are not exposed until an
-- explicit, audited assignment is performed.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts', 'debts', 'recurring_obligations', 'income_sources',
    'credit_cards', 'household_tasks', 'whatsapp_connections',
    'categories', 'transactions', 'budgets', 'work_entries'
  ] loop
    execute format('drop policy if exists household_access on public.%I', table_name);
    execute format('create policy household_access on public.%I for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', table_name);
  end loop;
end $$;

drop policy if exists household_access on public.households;
create policy household_access on public.households for select to authenticated
  using (public.is_household_member(id));
drop policy if exists household_access on public.household_members;
create policy household_access on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
drop policy if exists household_access on public.debt_payments;
create policy household_access on public.debt_payments for all to authenticated
  using (exists (select 1 from public.debts d where d.id = debt_id and public.is_household_member(d.household_id)))
  with check (exists (select 1 from public.debts d where d.id = debt_id and public.is_household_member(d.household_id)));
drop policy if exists household_access on public.card_statements;
create policy household_access on public.card_statements for all to authenticated
  using (exists (select 1 from public.credit_cards c where c.id = credit_card_id and public.is_household_member(c.household_id)))
  with check (exists (select 1 from public.credit_cards c where c.id = credit_card_id and public.is_household_member(c.household_id)));
drop policy if exists household_access on public.card_purchases;
create policy household_access on public.card_purchases for all to authenticated
  using (exists (select 1 from public.credit_cards c where c.id = credit_card_id and public.is_household_member(c.household_id)))
  with check (exists (select 1 from public.credit_cards c where c.id = credit_card_id and public.is_household_member(c.household_id)));
drop policy if exists household_access on public.card_installments;
create policy household_access on public.card_installments for all to authenticated
  using (exists (select 1 from public.card_purchases p join public.credit_cards c on c.id = p.credit_card_id where p.id = purchase_id and public.is_household_member(c.household_id)))
  with check (exists (select 1 from public.card_purchases p join public.credit_cards c on c.id = p.credit_card_id where p.id = purchase_id and public.is_household_member(c.household_id)));
drop policy if exists household_access on public.card_payments;
create policy household_access on public.card_payments for all to authenticated
  using (exists (select 1 from public.card_statements s join public.credit_cards c on c.id = s.credit_card_id where s.id = statement_id and public.is_household_member(c.household_id)))
  with check (exists (select 1 from public.card_statements s join public.credit_cards c on c.id = s.credit_card_id where s.id = statement_id and public.is_household_member(c.household_id)));
drop policy if exists household_access on public.task_attachments;
create policy household_access on public.task_attachments for all to authenticated
  using (exists (select 1 from public.household_tasks t where t.id = task_id and public.is_household_member(t.household_id)))
  with check (exists (select 1 from public.household_tasks t where t.id = task_id and public.is_household_member(t.household_id)));
drop policy if exists household_access on public.task_history;
create policy household_access on public.task_history for all to authenticated
  using (exists (select 1 from public.household_tasks t where t.id = task_id and public.is_household_member(t.household_id)))
  with check (exists (select 1 from public.household_tasks t where t.id = task_id and public.is_household_member(t.household_id)));
drop policy if exists household_access on public.whatsapp_groups;
create policy household_access on public.whatsapp_groups for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists household_access on public.whatsapp_messages;
create policy household_access on public.whatsapp_messages for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists household_access on public.whatsapp_extractions;
create policy household_access on public.whatsapp_extractions for all to authenticated
  using (exists (select 1 from public.whatsapp_messages m where m.id = message_id and public.is_household_member(m.household_id)))
  with check (exists (select 1 from public.whatsapp_messages m where m.id = message_id and public.is_household_member(m.household_id)));
