import { supabase } from '@/lib/supabase/client'

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

export interface ProgressInfo {
  loaded: number
  total: number
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

const BATCH_SIZE = 500

function applySearchFilter(query: any, searchTerm?: string) {
  if (!searchTerm) return query
  return query.or(`produto.ilike.%${searchTerm}%,produto_codigo.ilike.%${searchTerm}%`)
}

export async function getNecessidadeCompra(
  searchTerm?: string,
  onProgress?: (info: ProgressInfo) => void,
): Promise<NecessidadeCompraRow[]> {
  const countQuery = applySearchFilter(
    (supabase as any).from('vw_necessidade_compra').select('*', { count: 'exact', head: true }),
    searchTerm,
  )

  const { count, error: countError } = await countQuery
  if (countError) throw countError

  const total = count ?? 0
  if (total === 0) {
    onProgress?.({ loaded: 0, total: 0 })
    return []
  }

  const allRows: NecessidadeCompraRow[] = []
  let start = 0

  while (start < total) {
    const end = Math.min(start + BATCH_SIZE - 1, total - 1)
    let batchQuery = (supabase as any)
      .from('vw_necessidade_compra')
      .select('*')
      .range(start, end)
      .order('necessidade_compra', { ascending: false })

    batchQuery = applySearchFilter(batchQuery, searchTerm)

    const { data, error } = await batchQuery
    if (error) throw error

    if (data) {
      allRows.push(...(data as NecessidadeCompraRow[]))
    }

    onProgress?.({ loaded: allRows.length, total })
    start += BATCH_SIZE
  }

  return allRows
}

export async function getEntregaFuturaPorProduto(produtoId: string): Promise<EntregaFuturaRow[]> {
  const { data, error } = await (supabase as any)
    .from('vw_entrega_futura_projeto_item')
    .select('*')
    .eq('produto_id', produtoId)
    .order('atualizado_em', { ascending: false })

  if (error) throw error

  return (data as EntregaFuturaRow[]) ?? []
}
