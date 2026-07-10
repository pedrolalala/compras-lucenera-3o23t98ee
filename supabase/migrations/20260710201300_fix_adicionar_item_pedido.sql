DROP FUNCTION IF EXISTS public.adicionar_item_pedido(UUID, UUID, UUID, NUMERIC, NUMERIC);

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
