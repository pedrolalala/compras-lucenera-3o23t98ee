import { supabase } from '@/lib/supabase/client'

export interface EstoqueProdutoRow {
  produto_id: string
  produto_codigo: string | null
  produto: string
  sku: string | null
  referencia: string | null
  marca: string | null
  categoria: string | null
  unidade: string | null
  estoque_total: number
  estoque_disponivel: number
  estoque_showroom: number
  qtd_estoque_itens: number
  qtd_reservada: number
  custo_total: number
  preco_custo: number | null
  preco_venda: number | null
  ativo: boolean
  updated_at: string | null
}

export interface ProgressInfo {
  loaded: number
  total: number
}

const BATCH_SIZE = 500

function applySearch(query: any, term?: string) {
  if (!term?.trim()) return query
  const t = term.trim()
  return query.or(
    `produto.ilike.%${t}%,produto_codigo.ilike.%${t}%,sku.ilike.%${t}%,referencia.ilike.%${t}%,marca.ilike.%${t}%`,
  )
}

export async function getEstoqueProdutos(
  searchTerm?: string,
  onProgress?: (info: ProgressInfo) => void,
): Promise<EstoqueProdutoRow[]> {
  const countQuery = applySearch(
    (supabase as any).from('vw_estoque_produtos').select('*', { count: 'exact', head: true }),
    searchTerm,
  )

  const { count, error: countError } = await countQuery
  if (countError) throw countError

  const total = count ?? 0
  if (total === 0) {
    onProgress?.({ loaded: 0, total: 0 })
    return []
  }

  const allRows: EstoqueProdutoRow[] = []
  let start = 0

  while (start < total) {
    const end = Math.min(start + BATCH_SIZE - 1, total - 1)
    let batchQuery = (supabase as any)
      .from('vw_estoque_produtos')
      .select('*')
      .range(start, end)
      .order('produto_codigo', { ascending: true, nullsFirst: false })

    batchQuery = applySearch(batchQuery, searchTerm)

    const { data, error } = await batchQuery
    if (error) throw error

    if (data) allRows.push(...(data as EstoqueProdutoRow[]))
    onProgress?.({ loaded: allRows.length, total })
    start += BATCH_SIZE
  }

  return allRows
}
