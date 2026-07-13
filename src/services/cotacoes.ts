import { supabase } from '@/lib/supabase/client'

export async function atualizarPrecoCusto(produtoId: string, precoCusto: number): Promise<void> {
  const { error } = await (supabase as any).rpc('atualizar_preco_custo_produto', {
    p_produto_id: produtoId,
    p_preco_custo: precoCusto,
  })
  if (error) throw error
}
