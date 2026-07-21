import { supabase } from '@/lib/supabase/client'

export async function atualizarPrecoCusto(produtoId: string, precoCusto: number): Promise<void> {
  const { error } = await (supabase as any).rpc('atualizar_preco_custo_produto', {
    p_produto_id: produtoId,
    p_preco_custo: precoCusto,
  })
  if (error) throw error
}

/**
 * SPEC-038 Item 5 (P-05, decisão do usuário): grava em
 * produtos.percentual_desconto_compra, coluna DEDICADA e isolada de
 * produtos.porc_desconto (que alimenta fn_atualizar_preco_venda() / preço de
 * VENDA ao cliente). Não usar atualizar_preco_custo_produto para isso.
 */
export async function atualizarDescontoCompra(
  produtoId: string,
  percentualDesconto: number,
): Promise<void> {
  const { error } = await (supabase as any).rpc('atualizar_desconto_compra_produto', {
    p_produto_id: produtoId,
    p_percentual_desconto: percentualDesconto,
  })
  if (error) throw error
}
