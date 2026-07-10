import { supabase } from '@/lib/supabase/client'
import { mockNecessidadeCompra, mockEntregaFutura } from './mock-data'

export interface NecessidadeCompraRow {
  produto_id: string
  produto: string
  produto_codigo: string | null
  qtd_fisica: number
  qtd_comprometida: number
  necessidade_compra: number
  qtd_disponivel: number
  projetos_com_entrega_futura: number
}

export interface EntregaFuturaRow {
  projeto_item_id: string
  produto_id: string
  produto: string
  produto_codigo: string | null
  projeto_id: string | null
  projeto_codigo: string | null
  orcamento_id: string | null
  orcamento_numero: string | null
  cliente_id: string | null
  cliente: string | null
  q_venda: number
  q_entrega_futura: number
  q_reserva: number
  q_transferida_saida: number
  atualizado_em: string | null
}

export async function getNecessidadeCompra(searchTerm?: string): Promise<NecessidadeCompraRow[]> {
  try {
    let query = (supabase as any).from('vw_necessidade_compra').select('*')

    if (searchTerm) {
      query = query.or(`produto.ilike.%${searchTerm}%,produto_codigo.ilike.%${searchTerm}%`)
    }

    const { data, error } = await query.order('necessidade_compra', { ascending: false })
    if (error) throw error
    if (data && data.length > 0) return data as NecessidadeCompraRow[]
    return filterMock(mockNecessidadeCompra, searchTerm)
  } catch {
    return filterMock(mockNecessidadeCompra, searchTerm)
  }
}

function filterMock(rows: NecessidadeCompraRow[], searchTerm?: string): NecessidadeCompraRow[] {
  if (!searchTerm) return rows
  const term = searchTerm.toLowerCase()
  return rows.filter(
    (r) =>
      r.produto.toLowerCase().includes(term) ||
      (r.produto_codigo ?? '').toLowerCase().includes(term),
  )
}

export async function getEntregaFuturaPorProduto(produtoId: string): Promise<EntregaFuturaRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('vw_entrega_futura_projeto_item')
      .select('*')
      .eq('produto_id', produtoId)
      .order('atualizado_em', { ascending: false })

    if (error) throw error
    if (data && data.length > 0) return data as EntregaFuturaRow[]
    return mockEntregaFutura[produtoId] ?? []
  } catch {
    return mockEntregaFutura[produtoId] ?? []
  }
}
