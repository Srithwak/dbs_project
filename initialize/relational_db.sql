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
  user_id   uuid primary key default uuid_generate_v4(),
  name      text not null,
  email     text unique not null
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
-- SUPPLIER-PRODUCT RELATION (BCNF OK)
-- ============================================================

create table public.supplier_product (
  supplier_id   uuid not null references public.supplier(supplier_id) on delete cascade,
  product_id    uuid not null references public.product(product_id) on delete cascade,
  price         numeric(12, 2),
  priority      int,
  stock_qty     int,
  primary key (supplier_id, product_id)
);


-- ============================================================
-- ORDERS (FIXED)
-- ============================================================

create table public.orders (
  order_id      uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.users(user_id) on delete set null,
  transport_id  uuid references public.transport_method(transport_id) on delete set null,
  order_date    timestamptz default now(),
  total_price   numeric(12, 2),
  status        text default 'pending',
  ship_addr     text
);


-- ============================================================
-- ORDER ITEMS (FIXED: now includes product + supplier)
-- ============================================================

create table public.order_item (
  order_id      uuid not null references public.orders(order_id) on delete cascade,
  item_id       uuid not null default uuid_generate_v4(),
  
  product_id    uuid not null,
  supplier_id   uuid not null,

  quantity      int not null default 1,
  unit_price    numeric(12, 2),
  item_co2_kg   numeric(12, 6),

  primary key (order_id, item_id),

  -- enforce valid supplier-product combo
  foreign key (supplier_id, product_id)
    references public.supplier_product(supplier_id, product_id)
    on delete restrict
);


-- ============================================================
-- INDEXES
-- ============================================================

create index on public.orders (user_id);
create index on public.orders (transport_id);
create index on public.order_item (order_id);
create index on public.supplier_product (product_id);
