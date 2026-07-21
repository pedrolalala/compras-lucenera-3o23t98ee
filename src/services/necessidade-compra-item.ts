import { supabase } from '@/lib/supabase/client'

// SPEC-040 — Fluxo B ("Por Item de Orçamento") da tela Necessidade de
// Compra. Granularidade real: 1 linha por projeto_item_id (1:1 com
// orcamento_item_id), em vez de agregada por produto_id como o Fluxo A
// (vw_necessidade_compra, services/necessidade-compra.ts — não tocado por
// este arquivo).
export interface NecessidadeCompraItemRow {
  projeto_item_id: string
  produto_id: string
  produto: string
  produto_codigo: string | null
  orcamento_id: string | null
  orcamento_numero: string | null
  orcamento_item_id: string
  // "L Fixo" — posição/linha do orçamento de origem
  // (orcamento_itens.custom_id, snapshotado em projeto_itens.l_fixo).
  // NULL quando o item de orçamento de origem não tinha custom_id
  // preenchido (decisão do usuário P-04: linha própria, "—" na coluna).
  l_fixo: string | null
  preco_custo: number | null
  percentual_desconto_compra: number | null
  marca_id: string | null
  marca_nome: string | null
  fornecedor_id: string | null
  fornecedor_nome: string | null
  q_entrega_futura: number
  qtd_coberta_por_pedido_aberto: number
  pendente_item: number
}

export interface ProgressInfo {
  loaded: number
  total: number
}

const BATCH_SIZE = 500

// SPEC-039 (bug fix) reaplicado aqui: produto_codigo é `integer` no
// Postgres — `ilike` não existe para esse tipo, e isso derrubava a query
// inteira para qualquer busca não vazia.
function applySearchFilter(query: any, searchTerm?: string) {
  if (!searchTerm) return query
  const trimmed = searchTerm.trim()
  if (!trimmed) return query

  const isNumeric = /^\d+$/.test(trimmed)
  if (isNumeric) {
    return query.or(`produto.ilike.%${trimmed}%,produto_codigo.eq.${parseInt(trimmed, 10)}`)
  }
  return query.ilike('produto', `%${trimmed}%`)
}

export async function getNecessidadeCompraPorItem(
  searchTerm?: string,
  onProgress?: (info: ProgressInfo) => void,
): Promise<NecessidadeCompraItemRow[]> {
  const countQuery = applySearchFilter(
    (supabase as any)
      .from('vw_necessidade_compra_item_orcamento')
      .select('*', { count: 'exact', head: true }),
    searchTerm,
  )

  const { count, error: countError } = await countQuery
  if (countError) throw countError

  const total = count ?? 0
  if (total === 0) {
    onProgress?.({ loaded: 0, total: 0 })
    return []
  }

  const allRows: NecessidadeCompraItemRow[] = []
  let start = 0

  while (start < total) {
    const end = Math.min(start + BATCH_SIZE - 1, total - 1)
    let batchQuery = (supabase as any)
      .from('vw_necessidade_compra_item_orcamento')
      .select('*')
      .range(start, end)
      .order('orcamento_numero', { ascending: true })
      .order('l_fixo', { ascending: true, nullsFirst: false })

    batchQuery = applySearchFilter(batchQuery, searchTerm)

    const { data, error } = await batchQuery
    if (error) throw error

    if (data) {
      allRows.push(...(data as NecessidadeCompraItemRow[]))
    }

    onProgress?.({ loaded: allRows.length, total })
    start += BATCH_SIZE
  }

  return allRows
}
