-- Cashflow: customers, deals (sales with items), payments, expenses, documents
-- Access: founder (super_admin) only. To also let managers in, change hisab_can_access() below.

CREATE OR REPLACE FUNCTION public.hisab_can_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin();
$$;

-- One settings row for the whole business
CREATE TABLE public.hisab_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL DEFAULT 'My Business',
  alert_days INT NOT NULL DEFAULT 30 CHECK (alert_days IN (15, 30, 45, 60)),
  reminder_message TEXT NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{ "name": "Website", "rate": 30000 }]
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,    -- ["Marketing", "Rent"]
  invoice_template TEXT NOT NULL,
  agreement_template TEXT NOT NULL,
  next_invoice_no INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hisab_settings_singleton ON public.hisab_settings ((true));

CREATE TABLE public.hisab_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business TEXT,
  contact_person TEXT,
  phone TEXT,
  city TEXT,
  notes TEXT NOT NULL DEFAULT '',
  promise_amount NUMERIC(12, 2),
  promise_date DATE,
  last_reminder_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A deal is a sale. items = [{ "product": "Website", "qty": 2, "rate": 30000 }]
CREATE TABLE public.hisab_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.hisab_customers(id) ON DELETE CASCADE,
  deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL,
  total NUMERIC(12, 2) NOT NULL CHECK (total > 0),
  note TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every payment belongs to a deal
CREATE TABLE public.hisab_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.hisab_deals(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hisab_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice / agreement / payment proof. source 'made' = built from template (content), 'pdf' = uploaded file
CREATE TABLE public.hisab_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.hisab_customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('agreement', 'invoice', 'proof')),
  source TEXT NOT NULL CHECK (source IN ('made', 'pdf')),
  deal_id UUID REFERENCES public.hisab_deals(id) ON DELETE SET NULL,
  doc_number TEXT,
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hisab_deals_customer ON public.hisab_deals(customer_id);
CREATE INDEX idx_hisab_deals_date ON public.hisab_deals(deal_date);
CREATE INDEX idx_hisab_payments_deal ON public.hisab_payments(deal_id);
CREATE INDEX idx_hisab_payments_paid_on ON public.hisab_payments(paid_on);
CREATE INDEX idx_hisab_expenses_spent_on ON public.hisab_expenses(spent_on);
CREATE INDEX idx_hisab_documents_customer ON public.hisab_documents(customer_id, kind, created_at DESC);

-- A payment can never be more than what is left on its deal
CREATE OR REPLACE FUNCTION public.hisab_check_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC;
  v_paid NUMERIC;
BEGIN
  SELECT total INTO v_total FROM public.hisab_deals WHERE id = NEW.deal_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.hisab_payments
    WHERE deal_id = NEW.deal_id AND id IS DISTINCT FROM NEW.id;
  IF v_paid + NEW.amount > v_total THEN
    RAISE EXCEPTION 'Payment is more than what is left on this deal';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hisab_payments_check
  BEFORE INSERT OR UPDATE OF amount, deal_id ON public.hisab_payments
  FOR EACH ROW EXECUTE FUNCTION public.hisab_check_payment();

-- Row level security: everything goes through hisab_can_access()
ALTER TABLE public.hisab_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hisab_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hisab_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hisab_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hisab_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hisab_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hisab_settings_all" ON public.hisab_settings FOR ALL TO authenticated
  USING (public.hisab_can_access()) WITH CHECK (public.hisab_can_access());
CREATE POLICY "hisab_customers_all" ON public.hisab_customers FOR ALL TO authenticated
  USING (public.hisab_can_access()) WITH CHECK (public.hisab_can_access());
CREATE POLICY "hisab_deals_all" ON public.hisab_deals FOR ALL TO authenticated
  USING (public.hisab_can_access()) WITH CHECK (public.hisab_can_access());
CREATE POLICY "hisab_payments_all" ON public.hisab_payments FOR ALL TO authenticated
  USING (public.hisab_can_access()) WITH CHECK (public.hisab_can_access());
CREATE POLICY "hisab_expenses_all" ON public.hisab_expenses FOR ALL TO authenticated
  USING (public.hisab_can_access()) WITH CHECK (public.hisab_can_access());
CREATE POLICY "hisab_documents_all" ON public.hisab_documents FOR ALL TO authenticated
  USING (public.hisab_can_access()) WITH CHECK (public.hisab_can_access());

GRANT SELECT, INSERT, UPDATE ON public.hisab_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hisab_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hisab_deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hisab_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hisab_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hisab_documents TO authenticated;

-- Private bucket for uploaded invoices / agreements / payment proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hisab-docs',
  'hisab-docs',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hisab_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hisab-docs' AND public.hisab_can_access());
CREATE POLICY "hisab_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hisab-docs' AND public.hisab_can_access());
CREATE POLICY "hisab_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hisab-docs' AND public.hisab_can_access());
CREATE POLICY "hisab_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hisab-docs' AND public.hisab_can_access());
