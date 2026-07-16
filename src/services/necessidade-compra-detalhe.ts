import { supabase } from '@/lib/supabase/client'

export interface NecessidadeCompraDetalheRow {
  produto_id: string
  produto_codigo: string | null
  produto: string
  qtd_estoque: number
  qtd_reservada: number
  deficit_total: number
  projeto_item_id: string
  projeto_codigo: string | null
  projeto_nome: string | null
  orcamento_numero: string | null
  cliente_id: string | null
  cliente: string | null
  qtd_vendida: number
  q_reserva: number
  q_entrega_futura: number
}

export async function getNecessidadeCompraDetalhe(
  produtoId: string,
): Promise<NecessidadeCompraDetalheRow[]> {
  const { data, error } = await (supabase as any)
    .from('vw_necessidade_compra_detalhe')
    .select('*')
    .eq('produto_id', produtoId)
    .order('q_entrega_futura', { ascending: false })

  if (error) throw error
  return (data ?? []) as NecessidadeCompraDetalheRow[]
}
