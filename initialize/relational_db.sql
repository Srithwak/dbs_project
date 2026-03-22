-- ============================================================
-- ENABLE UUID EXTENSION
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- CORE TABLES
-- ============================================================

create table public.product (
  product_id    uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  category      text,
  weight_kg     numeric(10, 3)
);

create table public.supplier (
  supplier_id     uuid primary key default uuid_generate_v4(),
  name            text not null,
  contact_email   text,
  country         text,
  city            text
);

create table public.users (
  user_id           uuid primary key default uuid_generate_v4(),
  name              text not null,
  email             text unique not null,
  co2_per_kg_prod   numeric(10, 4)
);

create table public.transport_method (
  transport_id      uuid primary key default uuid_generate_v4(),
  mode              text not null,
  avg_speed_kmh     numeric(10, 2),
  co2_per_km_kg     numeric(10, 6)
);

create table public.carbon_goal (
  goal_id       uuid primary key default uuid_generate_v4(),
  period        text,
  target_co2    numeric(12, 4),
  actual_co2    numeric(12, 4)
);


-- ============================================================
-- JUNCTION / RELATIONSHIP TABLES
-- ============================================================

create table public.supplier_product (
  supplier_id   uuid not null references public.supplier(supplier_id) on delete cascade,
  product_id    uuid not null references public.product(product_id) on delete cascade,
  price         numeric(12, 2),
  priority      int,
  stock_qty     int,
  primary key (supplier_id, product_id)
);

create table public.orders (
  order_id      uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(user_id) on delete set null,
  transport_id  uuid not null references public.transport_method(transport_id) on delete set null,
  order_date    timestamptz default now(),
  total_price   numeric(12, 2),
  status        text default 'pending',
  ship_addr     text
);

create table public.order_item (
  order_id      uuid not null references public.orders(order_id) on delete cascade,
  item_id       uuid not null default uuid_generate_v4(),
  quantity      int not null default 1,
  unit_price    numeric(12, 2),
  item_co2_kg   numeric(12, 6),
  primary key (order_id, item_id)
);

-- Links order items back to the specific supplier+product they came from
create table public.involves (
  supplier_id   uuid not null,
  product_id    uuid not null,
  order_id      uuid not null,
  item_id       uuid not null,
  primary key (supplier_id, product_id, order_id, item_id),
  foreign key (supplier_id, product_id) references public.supplier_product(supplier_id, product_id) on delete cascade,
  foreign key (order_id, item_id)       references public.order_item(order_id, item_id) on delete cascade
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- RLS is a Supabase best practice. Policies below are a starting
-- point — tighten them to match your auth requirements.

alter table public.product          enable row level security;
alter table public.supplier         enable row level security;
alter table public.users            enable row level security;
alter table public.transport_method enable row level security;
alter table public.carbon_goal      enable row level security;
alter table public.supplier_product enable row level security;
alter table public.orders           enable row level security;
alter table public.order_item       enable row level security;
alter table public.involves         enable row level security;

-- Allow authenticated users to read reference/catalogue data
create policy "Public read: product"          on public.product          for select using (true);
create policy "Public read: supplier"         on public.supplier         for select using (true);
create policy "Public read: transport_method" on public.transport_method for select using (true);
create policy "Public read: supplier_product" on public.supplier_product for select using (true);
create policy "Public read: carbon_goal"      on public.carbon_goal      for select using (true);

-- Users can only see and edit their own row
create policy "Users: select own"  on public.users for select using (auth.uid() = user_id);
create policy "Users: update own"  on public.users for update using (auth.uid() = user_id);

-- Users can only see their own orders and order items
create policy "Orders: select own" on public.orders     for select using (auth.uid() = user_id);
create policy "Orders: insert own" on public.orders     for insert with check (auth.uid() = user_id);
create policy "Orders: update own" on public.orders     for update using (auth.uid() = user_id);

create policy "Order items: select own" on public.order_item for select
  using (exists (
    select 1 from public.orders o
    where o.order_id = order_item.order_id and o.user_id = auth.uid()
  ));

create policy "Involves: select own" on public.involves for select
  using (exists (
    select 1 from public.orders o
    where o.order_id = involves.order_id and o.user_id = auth.uid()
  ));


-- ============================================================
-- INDEXES (performance helpers)
-- ============================================================
create index on public.orders      (user_id);
create index on public.orders      (transport_id);
create index on public.order_item  (order_id);
create index on public.involves    (order_id, item_id);
create index on public.supplier_product (product_id);
