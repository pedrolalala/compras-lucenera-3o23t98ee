import { supabase } from '@/lib/supabase/client'

export interface Fornecedor {
  id: string
  nome: string
}

export interface CriarPedidoInput {
  produto_id: string
  fornecedor_id: string
  quantidade: number
  custo_unitario: number
  // SPEC-038 Item 2: numero agora opcional — se ausente/vazio, o backend
  // gera automaticamente (trigger_set_pedido_compra_numero, PC-<ano>-NNNN).
  numero?: string
  data_prevista_entrega?: string
  condicoes_pagamento?: string
  observacao?: string
  // SPEC-038 Item 1: breakdown de custo/impostos efetivo desta compra.
  // custo_unitario continua representando o TOTAL (líquido + impostos).
  custo_liquido?: number
  valor_icms?: number
  valor_ipi?: number
  valor_st?: number
}

export interface CriarPedidoResult {
  pedido_id: string
  solicitacao_id: string
  pedido_item_id: string
  numero: string
  status: string
}

export async function criarPedidoCompra(input: CriarPedidoInput): Promise<CriarPedidoResult> {
  const { data, error } = await (supabase as any).rpc('criar_pedido_compra_de_necessidade', {
    p_produto_id: input.produto_id,
    p_fornecedor_id: input.fornecedor_id,
    p_quantidade: input.quantidade,
    p_custo_unitario: input.custo_unitario,
    p_numero: input.numero?.trim() ? input.numero.trim() : null,
    p_data_prevista_entrega: input.data_prevista_entrega ?? null,
    p_condicoes_pagamento: input.condicoes_pagamento ?? null,
    p_observacao: input.observacao ?? null,
    p_custo_liquido: input.custo_liquido ?? null,
    p_valor_icms: input.valor_icms ?? null,
    p_valor_ipi: input.valor_ipi ?? null,
    p_valor_st: input.valor_st ?? null,
  })
  if (error) throw error
  return data as CriarPedidoResult
}

export async function getFornecedores(search?: string): Promise<Fornecedor[]> {
  // SPEC-030 Parte 2: busca fuzzy (pg_trgm + unaccent, threshold 0.3) via RPC
  // auxiliar — supabase-js não expõe similarity() em .from().select(). Mantém
  // o filtro contato_tipos.tipo = 'fornecedor' já corrigido na Parte 1.
  const { data, error } = await (supabase as any).rpc('buscar_fornecedores_fuzzy', {
    p_termo: search && search.trim() ? search.trim() : null,
  })
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({ id: d.id, nome: d.nome })) as Fornecedor[]
}

export interface ItemPedidoLote {
  produto_id: string
  quantidade: number
  custo_unitario: number
  // SPEC-038 Item 1 (opcional, por linha)
  custo_liquido?: number
  valor_icms?: number
  valor_ipi?: number
  valor_st?: number
}

export interface CriarPedidoLoteInput {
  fornecedor_id: string
  itens: ItemPedidoLote[]
  // SPEC-038 Item 2: numero agora opcional.
  numero?: string
  data_prevista_entrega?: string
  condicoes_pagamento?: string
  observacao?: string
}

export interface CriarPedidoLoteResult {
  pedido_id: string
  numero: string
  status: string
  valor_total: number
  qtd_itens: number
  itens: Array<{
    produto_id: string
    solicitacao_id: string
    pedido_item_id: string
    quantidade: number
    custo_unitario: number
  }>
}

export async function criarPedidoCompraLote(
  input: CriarPedidoLoteInput,
): Promise<CriarPedidoLoteResult> {
  const { data, error } = await (supabase as any).rpc('criar_pedido_compra_lote', {
    p_fornecedor_id: input.fornecedor_id,
    p_itens: input.itens,
    p_numero: input.numero?.trim() ? input.numero.trim() : null,
    p_data_prevista_entrega: input.data_prevista_entrega ?? null,
    p_condicoes_pagamento: input.condicoes_pagamento ?? null,
    p_observacao: input.observacao ?? null,
  })
  if (error) throw error
  return data as CriarPedidoLoteResult
}

// -----------------------------------------------------------------------
// SPEC-038 Item 1 — pré-preenchimento de custo/impostos a partir do produto
// -----------------------------------------------------------------------

export interface ProdutoImpostos {
  custoUnitario: number | null
  icmsEntradaPerc: number | null
  ipiEntradaPerc: number | null
  porcStPerc: number | null
}

/**
 * SPEC-038 Item 1 (P-02, default de implementação): busca os percentuais
 * mestres de imposto em `produtos` e, se houver override de custo em
 * `produto_fornecedores` para o par produto+fornecedor, esse custo vence
 * sobre `produtos.preco_custo` (mais específico). Os percentuais de
 * ICMS/IPI/ST sempre vêm de `produtos` — `produto_fornecedores` não tem
 * essas colunas.
 */
export async function getProdutoImpostos(
  produtoId: string,
  fornecedorId?: string | null,
): Promise<ProdutoImpostos> {
  const { data: produto, error } = await (supabase as any)
    .from('produtos')
    .select('preco_custo, icms_entrada, ipi_entrada, porc_st')
    .eq('id', produtoId)
    .maybeSingle()
  if (error) throw error

  let custoOverride: number | null = null
  if (fornecedorId) {
    const { data: pf } = await (supabase as any)
      .from('produto_fornecedores')
      .select('custo_unitario')
      .eq('produto_id', produtoId)
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
      .maybeSingle()
    custoOverride = pf?.custo_unitario ?? null
  }

  return {
    custoUnitario: custoOverride ?? produto?.preco_custo ?? null,
    icmsEntradaPerc: produto?.icms_entrada ?? null,
    ipiEntradaPerc: produto?.ipi_entrada ?? null,
    porcStPerc: produto?.porc_st ?? null,
  }
}

/**
 * SPEC-038 Item 1 — variante em lote de getProdutoImpostos, usada pelo
 * ModalPedidoLote.tsx (1 pedido = 1 fornecedor fixo, N produtos). Faz no
 * máximo 2 queries independentemente do tamanho do lote.
 */
export async function getProdutoImpostosBulk(
  produtoIds: string[],
  fornecedorId?: string | null,
): Promise<Map<string, ProdutoImpostos>> {
  const result = new Map<string, ProdutoImpostos>()
  if (produtoIds.length === 0) return result

  const { data: produtos, error } = await (supabase as any)
    .from('produtos')
    .select('id, preco_custo, icms_entrada, ipi_entrada, porc_st')
    .in('id', produtoIds)
  if (error) throw error

  const overrides = new Map<string, number>()
  if (fornecedorId) {
    const { data: pfs } = await (supabase as any)
      .from('produto_fornecedores')
      .select('produto_id, custo_unitario')
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
      .in('produto_id', produtoIds)
    ;(pfs ?? []).forEach((pf: any) => {
      if (pf.custo_unitario != null) overrides.set(pf.produto_id, pf.custo_unitario)
    })
  }

  ;(produtos ?? []).forEach((p: any) => {
    result.set(p.id, {
      custoUnitario: overrides.get(p.id) ?? p.preco_custo ?? null,
      icmsEntradaPerc: p.icms_entrada ?? null,
      ipiEntradaPerc: p.ipi_entrada ?? null,
      porcStPerc: p.porc_st ?? null,
    })
  })

  return result
}

// -----------------------------------------------------------------------
// SPEC-038 Item 3 — vínculo informativo pedido_compra_itens <-> projeto_itens
// -----------------------------------------------------------------------

export interface OrigemPedidoItemInput {
  pedido_compra_item_id: string
  projeto_item_id: string
  quantidade_atendida?: number | null
}

export async function vincularOrigemPedidoItem(origens: OrigemPedidoItemInput[]): Promise<void> {
  if (origens.length === 0) return
  for (const o of origens) {
    const { error } = await (supabase as any).rpc('vincular_origem_pedido_compra_item', {
      p_pedido_compra_item_id: o.pedido_compra_item_id,
      p_projeto_item_id: o.projeto_item_id,
      p_quantidade_atendida: o.quantidade_atendida ?? null,
    })
    if (error) throw error
  }
}

// -----------------------------------------------------------------------
// SPEC-038 Item 4 — parcelas do pedido de compra (lado pagável)
// -----------------------------------------------------------------------

export interface PedidoCompraParcela {
  id: string
  pedido_id: string
  numero_parcela: number
  valor: number
  data_vencimento: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacao: string | null
}

export async function gerarParcelasPedidoCompra(
  pedidoId: string,
): Promise<{ pedido_id: string; parcelas_criadas: number }> {
  const { data, error } = await (supabase as any).rpc('gerar_parcelas_pedido_compra', {
    p_pedido_id: pedidoId,
  })
  if (error) throw error
  return data as { pedido_id: string; parcelas_criadas: number }
}

export async function getParcelasPedidoCompra(pedidoId: string): Promise<PedidoCompraParcela[]> {
  const { data, error } = await (supabase as any)
    .from('pedido_compra_parcelas')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('numero_parcela', { ascending: true })
  if (error) throw error
  return (data ?? []) as PedidoCompraParcela[]
}

export async function atualizarParcelaPedidoCompra(
  parcelaId: string,
  valor: number,
  dataVencimento: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc('atualizar_parcela_pedido_compra', {
    p_parcela_id: parcelaId,
    p_valor: valor,
    p_data_vencimento: dataVencimento,
  })
  if (error) throw error
}

// -----------------------------------------------------------------------
// Listagem de pedidos_compra — usada pela nova página PedidosCompra.tsx
// (rota /pedidos, antes "Em breve"), onde o usuário visualiza/gera/edita
// as parcelas do Item 4.
// -----------------------------------------------------------------------

export interface PedidoCompraRow {
  id: string
  numero: string
  status: string
  data_emissao: string
  data_prevista_entrega: string | null
  condicoes_pagamento: string | null
  valor_total: number | null
  fornecedor_id: string
  fornecedor_nome: string
  criado_em: string
}

export async function getPedidosCompra(searchTerm?: string): Promise<PedidoCompraRow[]> {
  let query = (supabase as any)
    .from('pedidos_compra')
    .select('*, contatos!fornecedor_id(nome)')
    .order('criado_em', { ascending: false })
    .limit(300)

  if (searchTerm && searchTerm.trim()) {
    query = query.ilike('numero', `%${searchTerm.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({
    ...d,
    fornecedor_nome: d.contatos?.nome ?? '—',
  })) as PedidoCompraRow[]
}
