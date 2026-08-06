import { supabase } from '@/lib/supabase/client'

// SPEC-054 — Interface de Devolução de Estoque (linhas manuais por setor de
// origem). Segue o mesmo padrão de services/necessidade-compra-item.ts
// (busca debounced no componente, paginação em lote), mas a granularidade
// aqui é "item de projeto com saldo aberto em qualquer um dos 3 setores"
// (q_entrega_futura, q_reserva, q_entregue), não "item com necessidade de
// compra pendente".
//
// Lê vw_estoque_saldos_projeto_item (SPEC-010), a mesma view usada por
// vw_estoque_por_produto_projeto e outros consumidores já existentes —
// nomes de coluna confirmados em supabase/db/current/01_schema_full.sql.

export type SetorOrigemDevolucao = 'entrega_futura' | 'reserva' | 'entregue'

export interface DevolucaoSaldoItemRow {
  projeto_item_id: string
  projeto_id: string | null
  orcamento_id: string | null
  produto_id: string | null
  cliente_id: string | null
  produto: string
  produto_codigo: number | null
  projeto_codigo: string | null
  orcamento_numero: string | null
  q_venda: number
  q_reserva: number
  q_entrega_futura: number
  q_entregue: number
  q_devolvida: number
  status_operacional: string
}

export interface ProgressInfo {
  loaded: number
  total: number
}

export interface RegistrarDevolucaoResult {
  devolucao_id: string
  status: string
  setor_origem: SetorOrigemDevolucao
  quantidade: number
}

const BATCH_SIZE = 500

// Mesmo bug/fix já documentado em necessidade-compra-item.ts: produto_codigo
// é `integer` no Postgres — `ilike` não existe para esse tipo.
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

/**
 * Itens de projeto com saldo aberto em pelo menos um dos 3 setores
 * (q_entrega_futura + q_reserva + q_entregue > 0). Como as 3 colunas nunca
 * são negativas (CHECK constraints em estoque_saldos_projeto_item), "pelo
 * menos um setor > 0" é equivalente a "soma dos 3 > 0" — evita depender de
 * filtro computado, que o PostgREST não suporta nativamente.
 */
export async function getItensComSaldoParaDevolucao(
  searchTerm?: string,
  onProgress?: (info: ProgressInfo) => void,
): Promise<DevolucaoSaldoItemRow[]> {
  const baseFilter = (query: any) =>
    applySearchFilter(
      query
        .eq('status_operacional', 'ativo')
        .or('q_entrega_futura.gt.0,q_reserva.gt.0,q_entregue.gt.0'),
      searchTerm,
    )

  const countQuery = baseFilter(
    (supabase as any)
      .from('vw_estoque_saldos_projeto_item')
      .select('*', { count: 'exact', head: true }),
  )

  const { count, error: countError } = await countQuery
  if (countError) throw countError

  const total = count ?? 0
  if (total === 0) {
    onProgress?.({ loaded: 0, total: 0 })
    return []
  }

  const allRows: DevolucaoSaldoItemRow[] = []
  let start = 0

  while (start < total) {
    const end = Math.min(start + BATCH_SIZE - 1, total - 1)
    const batchQuery = baseFilter(
      (supabase as any)
        .from('vw_estoque_saldos_projeto_item')
        .select('*')
        .range(start, end)
        .order('orcamento_numero', { ascending: true }),
    )

    const { data, error } = await batchQuery
    if (error) throw error

    if (data) {
      allRows.push(...(data as DevolucaoSaldoItemRow[]))
    }

    onProgress?.({ loaded: allRows.length, total })
    start += BATCH_SIZE
  }

  return allRows
}

/**
 * Registra uma linha de devolução com setor de origem explícito, via a RPC
 * `registrar_devolucao_projeto_item_setor` (SPEC-054, migration
 * 20260727_067_spec054_devolucao_por_setor). Cada chamada = uma linha
 * lançada na UI = uma linha em devolucoes_estoque. Não é atômico entre
 * linhas de uma mesma sessão de lançamento (decisão da SPEC).
 */
export async function registrarDevolucaoPorSetor(
  projetoItemId: string,
  setorOrigem: SetorOrigemDevolucao,
  quantidade: number,
  motivo?: string,
): Promise<RegistrarDevolucaoResult> {
  const { data, error } = await supabase.rpc('registrar_devolucao_projeto_item_setor' as any, {
    p_projeto_item_id: projetoItemId,
    p_setor_origem: setorOrigem,
    p_quantidade: quantidade,
    p_motivo: motivo?.trim() || null,
  })
  if (error) throw error
  return data as RegistrarDevolucaoResult
}
