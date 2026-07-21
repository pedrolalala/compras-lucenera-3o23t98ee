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
  preco_custo: number | null
  // SPEC-030 Parte 2: marca e fornecedor resolvido (COALESCE
  // produtos.fornecedor_principal_id / marcas.fornecedor_id) vindos de
  // vw_necessidade_compra. fornecedor_id nulo => item fora do Pedido em Lote.
  marca_id: string | null
  marca_nome: string | null
  fornecedor_id: string | null
  fornecedor_nome: string | null
  // SPEC-038 Item 5: desconto negociado na COMPRA (produtos.percentual_desconto_compra),
  // distinto de produtos.porc_desconto (usado no preço de VENDA).
  percentual_desconto_compra: number | null
  // SPEC-039 (P-04): déficit ainda não coberto por pedido de compra em
  // aberto (GREATEST(0, necessidade_compra - qtd_em_pedidos_abertos)) —
  // coluna que decide a visibilidade da linha em vw_necessidade_compra.
  pendente: number
  // SPEC-039 (P-01): resumo agregado de pedidos_compra em aberto para este
  // produto — o detalhe pedido a pedido vem de getPedidosAbertosPorProduto.
  qtd_pedidos_abertos: number
  proxima_data_prevista_entrega: string | null
  // Status (cru) do pedido em aberto com entrega mais próxima — traduzir
  // com traduzirStatusPedidoCompra antes de exibir.
  status_mais_critico: string | null
}

export interface ProgressInfo {
  loaded: number
  total: number
}

// SPEC-039 (P-01/P-02/P-03): 1 linha por pedido_compra em aberto para um
// produto, usada no painel expansível (Empresa que comprou / Status do
// pedido / Data prevista de entrega no detalhe pedido a pedido).
export interface PedidoCompraAbertoRow {
  produto_id: string
  pedido_id: string
  numero: string
  status: string
  empresa_nome: string | null
  data_prevista_entrega: string | null
  qtd_pendente: number
}

// SPEC-039 (P-02): vocabulário de status decidido pelo usuário — mapeamento
// 1:1 do enum real de pedidos_compra.status para rótulo em português, sem
// incluir o estágio de cotação (fora do escopo desta SPEC).
export const STATUS_PEDIDO_COMPRA_LABEL: Record<string, string> = {
  rascunho: 'Pendente',
  aprovado: 'Aprovado',
  enviado: 'Pedido Emitido',
  parcialmente_recebido: 'Em Trânsito',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
}

export function traduzirStatusPedidoCompra(status: string | null | undefined): string {
  if (!status) return '-'
  return STATUS_PEDIDO_COMPRA_LABEL[status] ?? status
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
  aberto_desde: string | null
  dias_em_aberto: number | null
}

const BATCH_SIZE = 500

// SPEC-039 (bug fix): produto_codigo é `integer` no Postgres — `ilike` não
// existe para esse tipo (erro real confirmado via PostgREST: `42883
// operator does not exist: integer ~~* unknown`), e isso derrubava a query
// inteira (toda busca não vazia falhava, não só a busca por código).
function applySearchFilter(query: any, searchTerm?: string) {
  if (!searchTerm) return query
  const trimmed = searchTerm.trim()
  if (!trimmed) return query

  const isNumeric = /^\d+$/.test(trimmed)
  if (isNumeric) {
    // produto_codigo é integer — comparação exata, sem CAST em runtime
    // dentro do .or() do PostgREST (busca só por código exato, não
    // prefixo/substring).
    return query.or(`produto.ilike.%${trimmed}%,produto_codigo.eq.${parseInt(trimmed, 10)}`)
  }
  // Termo não numérico nunca poderia bater em produto_codigo (integer) —
  // gerar só a condição que faz sentido.
  return query.ilike('produto', `%${trimmed}%`)
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
    .order('dias_em_aberto', { ascending: false })

  if (error) throw error

  return (data as EntregaFuturaRow[]) ?? []
}

// SPEC-039 (P-01): lista os pedidos de compra abertos de um produto (número,
// status cru, empresa, data prevista) — usada no painel expansível ao lado
// dos projetos com entrega futura já existentes.
export async function getPedidosAbertosPorProduto(
  produtoId: string,
): Promise<PedidoCompraAbertoRow[]> {
  const { data, error } = await (supabase as any)
    .from('vw_necessidade_compra_pedido_detalhe')
    .select('*')
    .eq('produto_id', produtoId)
    .order('data_prevista_entrega', { ascending: true })

  if (error) throw error

  return (data as PedidoCompraAbertoRow[]) ?? []
}
