-- ENUMS
CREATE TYPE public.product_category AS ENUM ('rice','egg');
CREATE TYPE public.txn_type AS ENUM ('stock_in','stock_out','adjustment');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  username text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_number text,
  address text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_all_auth" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category public.product_category NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  selling_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_qty numeric(12,2) NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  min_stock numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_unique_name_category ON public.products (lower(name), category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_all_auth" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- EGG BATCHES
CREATE TABLE public.egg_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  expiration_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egg_batches TO authenticated;
GRANT ALL ON public.egg_batches TO service_role;
ALTER TABLE public.egg_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "egg_batches_all_auth" ON public.egg_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TRANSACTIONS
CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.txn_type NOT NULL,
  quantity numeric(12,2) NOT NULL,
  reason text,
  note text,
  resulting_stock numeric(12,2),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_transactions_created_idx ON public.inventory_transactions (created_at DESC);
GRANT SELECT, INSERT ON public.inventory_transactions TO authenticated;
GRANT ALL ON public.inventory_transactions TO service_role;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_read_auth" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "txn_insert_auth" ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- SETTINGS
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  near_expiry_days integer NOT NULL DEFAULT 7 CHECK (near_expiry_days > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_all_auth" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_settings (id, near_expiry_days) VALUES (1, 7);

-- AUTOMATIC STOCK UPDATE
CREATE OR REPLACE FUNCTION public.apply_inventory_transaction()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE current_qty numeric; new_qty numeric;
BEGIN
  IF NEW.quantity = 0 THEN
    RAISE EXCEPTION 'Quantity must not be zero';
  END IF;
  IF NEW.type = 'stock_in' AND NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Stock-in quantity must be positive';
  END IF;
  IF NEW.type = 'stock_out' AND NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Stock-out quantity must be positive';
  END IF;

  SELECT stock_qty INTO current_qty FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NEW.type = 'stock_in' THEN
    new_qty := current_qty + NEW.quantity;
  ELSIF NEW.type = 'stock_out' THEN
    new_qty := current_qty - NEW.quantity;
    IF new_qty < 0 THEN
      RAISE EXCEPTION 'Insufficient available stock: only % remaining', current_qty;
    END IF;
  ELSE
    new_qty := current_qty + NEW.quantity;
    IF new_qty < 0 THEN
      RAISE EXCEPTION 'Adjustment would result in negative stock: only % on record', current_qty;
    END IF;
  END IF;

  UPDATE public.products SET stock_qty = new_qty WHERE id = NEW.product_id;
  NEW.resulting_stock := new_qty;
  IF NEW.user_id IS NULL THEN NEW.user_id := auth.uid(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER inventory_txn_apply BEFORE INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_transaction();

-- SEED DATA
INSERT INTO public.suppliers (id, name, contact_number, address, email) VALUES
  ('11111111-1111-1111-1111-111111111111','CDP Enterprise (Own Supply)','0917-555-0101','Catalunan Grande, Davao City','supply@cdpenterprise.ph'),
  ('22222222-2222-2222-2222-222222222222','Davao Rice Traders','0918-222-3344','Bankerohan, Davao City',NULL),
  ('33333333-3333-3333-3333-333333333333','Mintal Poultry Farm','0920-777-8899','Mintal, Davao City','orders@mintalpoultry.ph');

INSERT INTO public.products (id, name, category, unit, selling_price, cost_price, stock_qty, min_stock, supplier_id) VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001','Sinandomeng Rice 25kg','rice','sack',1450.00,1300.00,42,10,'22222222-2222-2222-2222-222222222222'),
  ('aaaaaaa1-0000-4000-8000-000000000002','Jasmine Rice 25kg','rice','sack',1620.00,1480.00,8,10,'22222222-2222-2222-2222-222222222222'),
  ('aaaaaaa1-0000-4000-8000-000000000003','Well-milled Rice 50kg','rice','sack',2450.00,2250.00,15,6,'11111111-1111-1111-1111-111111111111'),
  ('aaaaaaa1-0000-4000-8000-000000000004','Dinorado Rice 5kg','rice','pack',360.00,315.00,0,12,'22222222-2222-2222-2222-222222222222'),
  ('bbbbbbb1-0000-4000-8000-000000000001','Chicken Eggs Large (Tray of 30)','egg','tray',270.00,235.00,60,20,'33333333-3333-3333-3333-333333333333'),
  ('bbbbbbb1-0000-4000-8000-000000000002','Chicken Eggs Medium (Tray of 30)','egg','tray',240.00,205.00,18,20,'33333333-3333-3333-3333-333333333333'),
  ('bbbbbbb1-0000-4000-8000-000000000003','Duck Eggs (Tray of 30)','egg','tray',330.00,290.00,12,5,'11111111-1111-1111-1111-111111111111');

INSERT INTO public.egg_batches (product_id, batch_number, quantity, expiration_date) VALUES
  ('bbbbbbb1-0000-4000-8000-000000000001','EGG-L-2601',35, CURRENT_DATE + 18),
  ('bbbbbbb1-0000-4000-8000-000000000001','EGG-L-2602',25, CURRENT_DATE + 4),
  ('bbbbbbb1-0000-4000-8000-000000000002','EGG-M-2611',18, CURRENT_DATE + 2),
  ('bbbbbbb1-0000-4000-8000-000000000003','DUCK-2620',12, CURRENT_DATE - 2);

INSERT INTO public.inventory_transactions (product_id, type, quantity, reason, note, created_at) VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001','stock_in',20,'Delivery received','Opening delivery', now() - interval '2 days'),
  ('aaaaaaa1-0000-4000-8000-000000000001','stock_out',8,'Sold','Walk-in customers', now() - interval '1 day'),
  ('bbbbbbb1-0000-4000-8000-000000000001','stock_in',30,'Delivery received','Batch EGG-L-2601', now() - interval '1 day'),
  ('bbbbbbb1-0000-4000-8000-000000000002','stock_out',6,'Sold','Sari-sari store order', now() - interval '4 hours'),
  ('bbbbbbb1-0000-4000-8000-000000000003','adjustment',-3,'Damaged products','Cracked eggs on delivery', now() - interval '3 hours'),
  ('aaaaaaa1-0000-4000-8000-000000000002','stock_out',4,'Sold','Regular buyer', now() - interval '2 hours');