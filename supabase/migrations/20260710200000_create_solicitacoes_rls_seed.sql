CREATE TABLE IF NOT EXISTS public.solicitacoes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  prioridade TEXT DEFAULT 'normal',
  observacao TEXT,
  status TEXT DEFAULT 'aberta',
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_produto_id ON public.solicitacoes_compra(produto_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON public.solicitacoes_compra(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_criado_em ON public.solicitacoes_compra(criado_em);

ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacoes_select" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_select" ON public.solicitacoes_compra FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "solicitacoes_insert" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_insert" ON public.solicitacoes_compra FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "solicitacoes_update" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_update" ON public.solicitacoes_compra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "solicitacoes_delete" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_delete" ON public.solicitacoes_compra FOR DELETE TO authenticated USING (true);

ALTER TABLE public.cotacoes_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotacoes_select" ON public.cotacoes_compra;
CREATE POLICY "cotacoes_select" ON public.cotacoes_compra FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cotacoes_insert" ON public.cotacoes_compra;
CREATE POLICY "cotacoes_insert" ON public.cotacoes_compra FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cotacoes_update" ON public.cotacoes_compra;
CREATE POLICY "cotacoes_update" ON public.cotacoes_compra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cotacoes_delete" ON public.cotacoes_compra;
CREATE POLICY "cotacoes_delete" ON public.cotacoes_compra FOR DELETE TO authenticated USING (true);

ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotacao_itens_select" ON public.cotacao_itens;
CREATE POLICY "cotacao_itens_select" ON public.cotacao_itens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cotacao_itens_insert" ON public.cotacao_itens;
CREATE POLICY "cotacao_itens_insert" ON public.cotacao_itens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cotacao_itens_update" ON public.cotacao_itens;
CREATE POLICY "cotacao_itens_update" ON public.cotacao_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cotacao_itens_delete" ON public.cotacao_itens;
CREATE POLICY "cotacao_itens_delete" ON public.cotacao_itens FOR DELETE TO authenticated USING (true);

ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedidos_select" ON public.pedidos_compra;
CREATE POLICY "pedidos_select" ON public.pedidos_compra FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pedidos_insert" ON public.pedidos_compra;
CREATE POLICY "pedidos_insert" ON public.pedidos_compra FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pedidos_update" ON public.pedidos_compra;
CREATE POLICY "pedidos_update" ON public.pedidos_compra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pedidos_delete" ON public.pedidos_compra;
CREATE POLICY "pedidos_delete" ON public.pedidos_compra FOR DELETE TO authenticated USING (true);

ALTER TABLE public.pedido_compra_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedido_itens_select" ON public.pedido_compra_itens;
CREATE POLICY "pedido_itens_select" ON public.pedido_compra_itens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pedido_itens_insert" ON public.pedido_compra_itens;
CREATE POLICY "pedido_itens_insert" ON public.pedido_compra_itens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pedido_itens_update" ON public.pedido_compra_itens;
CREATE POLICY "pedido_itens_update" ON public.pedido_compra_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pedido_itens_delete" ON public.pedido_compra_itens;
CREATE POLICY "pedido_itens_delete" ON public.pedido_compra_itens FOR DELETE TO authenticated USING (true);

ALTER TABLE public.recebimentos_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recebimentos_select" ON public.recebimentos_compra;
CREATE POLICY "recebimentos_select" ON public.recebimentos_compra FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "recebimentos_insert" ON public.recebimentos_compra;
CREATE POLICY "recebimentos_insert" ON public.recebimentos_compra FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recebimentos_update" ON public.recebimentos_compra;
CREATE POLICY "recebimentos_update" ON public.recebimentos_compra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.recebimento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recebimento_itens_select" ON public.recebimento_itens;
CREATE POLICY "recebimento_itens_select" ON public.recebimento_itens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "recebimento_itens_insert" ON public.recebimento_itens;
CREATE POLICY "recebimento_itens_insert" ON public.recebimento_itens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recebimento_itens_update" ON public.recebimento_itens;
CREATE POLICY "recebimento_itens_update" ON public.recebimento_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solicitacoes_update ON public.solicitacoes_compra;
CREATE TRIGGER trg_solicitacoes_update
  BEFORE UPDATE ON public.solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pedro@lucenera.com.br') THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'pedro@lucenera.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Pedro Lucenera"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );
  END IF;
END $$;
