CREATE OR REPLACE FUNCTION public.re_reservar_projeto_item(
  p_projeto_item_id UUID,
  p_quantidade NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_saldo RECORD;
  v_produto_id UUID;
  v_disponivel NUMERIC;
BEGIN
  SELECT * INTO v_saldo FROM public.estoque_saldos_projeto_item
  WHERE projeto_item_id = p_projeto_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Saldo não encontrado para o item do projeto.');
  END IF;

  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantidade deve ser maior que zero.');
  END IF;

  IF p_quantidade > v_saldo.q_entrega_futura THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantidade excede a entrega futura disponível.');
  END IF;

  SELECT produto_id INTO v_produto_id FROM public.projeto_itens WHERE id = p_projeto_item_id;

  SELECT COALESCE(SUM(quantidade - quantidade_reservada), 0) INTO v_disponivel
  FROM public.estoque_itens WHERE produto_id = v_produto_id;

  IF p_quantidade > v_disponivel THEN
    RETURN jsonb_build_object('success', false, 'message', 'Estoque físico insuficiente para re-reserva.');
  END IF;

  UPDATE public.estoque_saldos_projeto_item
  SET q_entrega_futura = q_entrega_futura - p_quantidade,
      q_reserva = q_reserva + p_quantidade,
      atualizado_em = now()
  WHERE projeto_item_id = p_projeto_item_id;

  UPDATE public.estoque_itens
  SET quantidade_reservada = quantidade_reservada + p_quantidade,
      atualizado_em = now()
  WHERE produto_id = v_produto_id AND local = 'Estoque';

  RETURN jsonb_build_object('success', true, 'message', 'Re-reserva realizada com sucesso.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_compra(
  p_pedido_id UUID,
  p_numero_nota TEXT,
  p_data DATE,
  p_itens JSONB
) RETURNS JSONB AS $$
DECLARE
  v_recebimento_id UUID;
  v_item JSONB;
  v_pedido_item_id UUID;
  v_qtd_recebida NUMERIC;
  v_divergencia TEXT;
  v_produto_id UUID;
  v_pedido_status TEXT;
  v_row_count INTEGER;
BEGIN
  INSERT INTO public.recebimentos_compra (pedido_id, numero_nota, data_recebimento, recebido_por)
  VALUES (p_pedido_id, p_numero_nota, p_data, auth.uid())
  RETURNING id INTO v_recebimento_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_pedido_item_id := (v_item->>'pedido_item_id')::uuid;
    v_qtd_recebida := (v_item->>'quantidade_recebida')::numeric;
    v_divergencia := v_item->>'divergencia';

    SELECT produto_id INTO v_produto_id FROM public.pedido_compra_itens WHERE id = v_pedido_item_id;

    INSERT INTO public.recebimento_itens (recebimento_id, pedido_item_id, produto_id, quantidade_recebida, divergencia)
    VALUES (v_recebimento_id, v_pedido_item_id, v_produto_id, v_qtd_recebida, v_divergencia);

    UPDATE public.pedido_compra_itens
    SET qtd_recebida = qtd_recebida + v_qtd_recebida
    WHERE id = v_pedido_item_id;

    UPDATE public.estoque_itens
    SET quantidade = quantidade + v_qtd_recebida, atualizado_em = now()
    WHERE produto_id = v_produto_id AND local = 'Estoque';

    IF NOT FOUND THEN
      INSERT INTO public.estoque_itens (produto_id, local, quantidade)
      VALUES (v_produto_id, 'Estoque', v_qtd_recebida);
    END IF;
  END LOOP;

  SELECT CASE
    WHEN COUNT(*) FILTER (WHERE qtd_recebida < quantidade) > 0 THEN 'parcialmente_recebido'
    ELSE 'recebido'
  END INTO v_pedido_status
  FROM public.pedido_compra_itens WHERE pedido_id = p_pedido_id;

  UPDATE public.pedidos_compra SET status = v_pedido_status, atualizado_em = now() WHERE id = p_pedido_id;

  RETURN jsonb_build_object('success', true, 'recebimento_id', v_recebimento_id, 'status', v_pedido_status, 'message', 'Recebimento registrado com sucesso.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.criar_solicitacao_compra(
  p_produto_id UUID, p_quantidade NUMERIC, p_prioridade TEXT DEFAULT 'normal', p_observacao TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.solicitacoes_compra (produto_id, quantidade, prioridade, observacao, criado_por)
  VALUES (p_produto_id, p_quantidade, p_prioridade, p_observacao, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.atualizar_status_solicitacao(p_id UUID, p_status TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.solicitacoes_compra SET status = p_status WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.criar_cotacao_compra(
  p_fornecedor_id UUID, p_validade DATE DEFAULT NULL, p_condicoes_pagamento TEXT DEFAULT NULL, p_observacao TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID; v_numero TEXT;
BEGIN
  v_numero := 'COT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
  INSERT INTO public.cotacoes_compra (numero, fornecedor_id, validade, condicoes_pagamento, observacao, criado_por)
  VALUES (v_numero, p_fornecedor_id, p_validade, p_condicoes_pagamento, p_observacao, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.adicionar_item_cotacao(
  p_cotacao_id UUID, p_solicitacao_id UUID, p_produto_id UUID, p_quantidade NUMERIC, p_custo_unitario NUMERIC, p_prazo_entrega_dias INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.cotacao_itens (cotacao_id, solicitacao_id, produto_id, quantidade, custo_unitario, prazo_entrega_dias)
  VALUES (p_cotacao_id, p_solicitacao_id, p_produto_id, p_quantidade, p_custo_unitario, p_prazo_entrega_dias)
  RETURNING id INTO v_id;
  UPDATE public.solicitacoes_compra SET status = 'em_cotacao' WHERE id = p_solicitacao_id AND status = 'aberta';
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.atualizar_status_cotacao(p_id UUID, p_status TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.cotacoes_compra SET status = p_status, atualizado_em = now() WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.criar_pedido_compra(
  p_fornecedor_id UUID, p_cotacao_id UUID DEFAULT NULL, p_condicoes_pagamento TEXT DEFAULT NULL, p_observacao TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID; v_numero TEXT;
BEGIN
  v_numero := 'PC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
  INSERT INTO public.pedidos_compra (numero, fornecedor_id, cotacao_id, condicoes_pagamento, observacao, criado_por)
  VALUES (v_numero, p_fornecedor_id, p_cotacao_id, p_condicoes_pagamento, p_observacao, auth.uid())
  RETURNING id INTO v_id;
  IF p_cotacao_id IS NOT NULL THEN
    UPDATE public.cotacoes_compra SET status = 'pedido_gerado', atualizado_em = now() WHERE id = p_cotacao_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.adicionar_item_pedido(
  p_pedido_id UUID,
  p_solicitacao_id UUID DEFAULT NULL,
  p_produto_id UUID DEFAULT NULL,
  p_quantidade NUMERIC DEFAULT NULL,
  p_custo_unitario NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.pedido_compra_itens (pedido_id, solicitacao_id, produto_id, quantidade, custo_unitario)
  VALUES (p_pedido_id, p_solicitacao_id, p_produto_id, p_quantidade, p_custo_unitario)
  RETURNING id INTO v_id;
  IF p_solicitacao_id IS NOT NULL THEN
    UPDATE public.solicitacoes_compra SET status = 'pedido_gerado' WHERE id = p_solicitacao_id;
  END IF;
  UPDATE public.pedidos_compra SET valor_total = COALESCE(valor_total, 0) + (p_quantidade * p_custo_unitario) WHERE id = p_pedido_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.atualizar_status_pedido(p_id UUID, p_status TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.pedidos_compra SET status = p_status, atualizado_em = now() WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
