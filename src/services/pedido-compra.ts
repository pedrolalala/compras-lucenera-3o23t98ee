import { supabase } from '@/lib/supabase/client'

export interface Fornecedor {
  id: string
  nome: string
}

export interface Empresa {
  id: string
  nome: string
}

export async function getEmpresas(): Promise<Empresa[]> {
  const { data, error } = await (supabase as any).from('empresas').select('id, nome').order('nome')
  if (error) throw error
  return (data ?? []) as Empresa[]
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
  valor_outras_despesas?: number
  // SPEC-057 (reunião 04/08/2026): empresa que está comprando precisa ser
  // escolhida por pedido, não fixa por usuário. perfil é só rótulo
  // Ribeirão/São Paulo (SPEC-064).
  empresa_id: string
  perfil?: string
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
    // SPEC-209 B6 (migration 225)
    p_valor_outras_despesas: input.valor_outras_despesas ?? null,
    p_empresa_id: input.empresa_id,
    p_perfil: input.perfil ?? null,
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
  // SPEC-209 B6 (migration 225)
  valor_outras_despesas?: number
}

export interface CriarPedidoLoteInput {
  fornecedor_id: string
  itens: ItemPedidoLote[]
  // SPEC-038 Item 2: numero agora opcional.
  numero?: string
  data_prevista_entrega?: string
  condicoes_pagamento?: string
  observacao?: string
  // SPEC-057: empresa por pedido (ver CriarPedidoInput).
  empresa_id?: string
  perfil?: string
  // SPEC-155 (P3): desconto negociado no pedido (%, aplicado sobre
  // valor_total pela RPC) e local de entrega (texto livre) -- os dois
  // opcionais, default preserva o comportamento anterior à migration
  // 20260921_155_modal_compra_desconto_local_entrega.
  desconto_percentual?: number
  local_entrega?: string
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
    p_empresa_id: input.empresa_id ?? null,
    p_perfil: input.perfil ?? null,
    p_desconto_percentual: input.desconto_percentual ?? null,
    p_local_entrega: input.local_entrega?.trim() ? input.local_entrega.trim() : null,
  })
  if (error) throw error
  return data as CriarPedidoLoteResult
}

// -----------------------------------------------------------------------
// SPEC-060 — cancelar pedido de compra
// -----------------------------------------------------------------------

// SPEC-209 D5: cancela quem ainda não teve entrada (Aguardando aprovar ou Aprovado).
// Concluído/Concluído parcialmente/já cancelado mostram erro claro.
export const STATUS_PEDIDO_COMPRA_CANCELAVEL = ['aguardando_aprovar', 'aprovado']

export async function cancelarPedidoCompra(pedidoId: string, motivo?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('cancelar_pedido_compra', {
    p_pedido_id: pedidoId,
    p_motivo: motivo?.trim() || null,
  })
  if (error) throw error
}

// -----------------------------------------------------------------------
// SPEC-038 Item 1 — pré-preenchimento de custo/impostos a partir do produto
// -----------------------------------------------------------------------

export interface ProdutoImpostos {
  // SPEC-209 B3: preço de custo JÁ com o desconto do produto (porc_desconto), como no
  // cadastro (SPEC-190). Custo do fornecedor (produto_fornecedores) vence e não leva desconto.
  custoUnitario: number | null
  icmsEntradaPerc: number | null
  ipiEntradaPerc: number | null
  porcStPerc: number | null
  // SPEC-209 B4: % de outras despesas do cadastro (produtos.porc_despesas)
  despesasPerc: number | null
  descontoPerc: number | null
  // SPEC-066 Frente C: "caixa fechada" — observação e quantidade mínima
  // de produto_fornecedores, exibidas só aqui (Fechar Pedido em Lote),
  // por decisão explícita da Débora (não na grid principal).
  observacaoFornecedor: string | null
  qtdMinima: number | null
}

// SPEC-209 B3: R$ 100 com 25% de desconto vira R$ 75 (máscara do cadastro).
function custoComDesconto(preco: number | null | undefined, descontoPerc: number | null | undefined) {
  if (preco == null) return null
  const d = Number(descontoPerc) || 0
  return d > 0 ? Math.round(preco * (1 - d / 100) * 10000) / 10000 : preco
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
  // SPEC-193 C2: custo/impostos só pela vw_produtos_custo (Administração).
  const { data: produto, error } = await (supabase as any)
    .from('vw_produtos_custo')
    .select('preco_custo, icms_entrada, ipi_entrada, porc_st, porc_despesas, porc_desconto')
    .eq('id', produtoId)
    .maybeSingle()
  if (error) throw error

  let custoOverride: number | null = null
  let observacaoFornecedor: string | null = null
  let qtdMinima: number | null = null
  if (fornecedorId) {
    const { data: pf } = await (supabase as any)
      .from('produto_fornecedores')
      .select('custo_unitario, observacao, qtd_minima')
      .eq('produto_id', produtoId)
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
      .maybeSingle()
    custoOverride = pf?.custo_unitario ?? null
    observacaoFornecedor = pf?.observacao ?? null
    qtdMinima = pf?.qtd_minima ?? null
  }

  return {
    custoUnitario: custoOverride ?? custoComDesconto(produto?.preco_custo, produto?.porc_desconto),
    icmsEntradaPerc: produto?.icms_entrada ?? null,
    ipiEntradaPerc: produto?.ipi_entrada ?? null,
    porcStPerc: produto?.porc_st ?? null,
    despesasPerc: produto?.porc_despesas ?? null,
    descontoPerc: produto?.porc_desconto ?? null,
    observacaoFornecedor,
    qtdMinima,
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

  // SPEC-193 C2: custo/impostos só pela vw_produtos_custo (Administração).
  const { data: produtos, error } = await (supabase as any)
    .from('vw_produtos_custo')
    .select('id, preco_custo, icms_entrada, ipi_entrada, porc_st, porc_despesas, porc_desconto')
    .in('id', produtoIds)
  if (error) throw error

  const overrides = new Map<string, number>()
  const observacoes = new Map<string, string>()
  const qtdsMinimas = new Map<string, number>()
  if (fornecedorId) {
    const { data: pfs } = await (supabase as any)
      .from('produto_fornecedores')
      .select('produto_id, custo_unitario, observacao, qtd_minima')
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
      .in('produto_id', produtoIds)
    ;(pfs ?? []).forEach((pf: any) => {
      if (pf.custo_unitario != null) overrides.set(pf.produto_id, pf.custo_unitario)
      if (pf.observacao) observacoes.set(pf.produto_id, pf.observacao)
      if (pf.qtd_minima != null) qtdsMinimas.set(pf.produto_id, pf.qtd_minima)
    })
  }

  ;(produtos ?? []).forEach((p: any) => {
    result.set(p.id, {
      custoUnitario: overrides.get(p.id) ?? custoComDesconto(p.preco_custo, p.porc_desconto),
      icmsEntradaPerc: p.icms_entrada ?? null,
      ipiEntradaPerc: p.ipi_entrada ?? null,
      porcStPerc: p.porc_st ?? null,
      despesasPerc: p.porc_despesas ?? null,
      descontoPerc: p.porc_desconto ?? null,
      observacaoFornecedor: observacoes.get(p.id) ?? null,
      qtdMinima: qtdsMinimas.get(p.id) ?? null,
    })
  })

  return result
}

/**
 * SPEC-066 Frente C: upsert de observação/qtd_minima ("caixa fechada")
 * para o par produto+fornecedor. Chamado a partir do Fechar Pedido em
 * Lote (único lugar onde essa informação é editável, por decisão da
 * Débora). Não mexe em custo_unitario (mantém o que já existir).
 */
export async function upsertObservacaoProdutoFornecedor(
  produtoId: string,
  fornecedorId: string,
  observacao: string | null,
  qtdMinima: number | null,
): Promise<void> {
  const { data: existing } = await (supabase as any)
    .from('produto_fornecedores')
    .select('id')
    .eq('produto_id', produtoId)
    .eq('fornecedor_id', fornecedorId)
    .maybeSingle()

  if (existing) {
    const { error } = await (supabase as any)
      .from('produto_fornecedores')
      .update({ observacao, qtd_minima: qtdMinima })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await (supabase as any).from('produto_fornecedores').insert({
      produto_id: produtoId,
      fornecedor_id: fornecedorId,
      observacao,
      qtd_minima: qtdMinima,
      ativo: true,
    })
    if (error) throw error
  }
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
  // SPEC-209: usados na edição e na lista
  empresa_id: string | null
  empresa_nome: string | null
  desconto_percentual: number | null
  observacao: string | null
  local_entrega: string | null
  motivo_cancelamento: string | null
}

export async function getPedidosCompra(searchTerm?: string): Promise<PedidoCompraRow[]> {
  // SPEC-116: o PostgREST não aceita combinar uma coluna própria (numero)
  // com uma coluna de resource embutido (contatos.nome) dentro do mesmo
  // .or() — testado direto contra a API real, dá erro de parse
  // (PGRST100). Como a lista já é limitada a 300 pedidos, o filtro
  // multi-termo (número OU fornecedor, em qualquer ordem, sem acento) é
  // aplicado no cliente, sobre os 300 já carregados.
  const { data, error } = await (supabase as any)
    .from('pedidos_compra')
    .select('*, contatos!fornecedor_id(nome), empresas(nome)')
    .order('criado_em', { ascending: false })
    .limit(300)
  if (error) throw error

  const rows = ((data ?? []) as any[]).map((d) => ({
    ...d,
    fornecedor_nome: d.contatos?.nome ?? '—',
    empresa_nome: d.empresas?.nome ?? null,
  })) as PedidoCompraRow[]

  const trimmed = searchTerm?.trim()
  if (!trimmed) return rows

  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const terms = normalize(trimmed).split(/\s+/).filter(Boolean)

  return rows.filter((r) => {
    const haystack = normalize([r.numero, r.fornecedor_nome].filter(Boolean).join(' '))
    return terms.every((t) => haystack.includes(t))
  })
}

// -----------------------------------------------------------------------
// SPEC-209 D/E/C — ciclo do pedido (reunião 19/10 com Vinicius e Débora)
// -----------------------------------------------------------------------

// Status gravados -> nome na tela. 'enviado'/'rascunho' deixaram de existir (migration 226).
export const STATUS_PEDIDO_COMPRA: { value: string; label: string }[] = [
  { value: 'aguardando_aprovar', label: 'Aguardando aprovar' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'parcialmente_recebido', label: 'Concluído parcialmente' },
  { value: 'recebido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

export const STATUS_PEDIDO_COMPRA_ABERTO = ['aguardando_aprovar', 'aprovado', 'parcialmente_recebido']

/** SPEC-209 F: aprovado entra no Contas a Pagar; `parcelas` = 0 quando não há condição de pagamento. */
export async function aprovarPedidoCompra(pedidoId: string): Promise<{ parcelas: number }> {
  const { data, error } = await (supabase as any).rpc('aprovar_pedido_compra', { p_pedido_id: pedidoId })
  if (error) throw error
  return { parcelas: Number(data?.parcelas) || 0 }
}

export interface ItemDoPedido {
  id: string
  produto_id: string
  produto_nome: string
  produto_codigo: string | null
  quantidade: number
  qtd_recebida: number
  custo_unitario: number
  custo_liquido: number | null
  valor_ipi: number | null
  valor_st: number | null
  valor_outras_despesas: number | null
}

export async function getItensDoPedido(pedidoId: string): Promise<ItemDoPedido[]> {
  const { data, error } = await (supabase as any)
    .from('pedido_compra_itens')
    .select(
      'id, produto_id, quantidade, qtd_recebida, custo_unitario, custo_liquido, valor_ipi, valor_st, valor_outras_despesas, produtos(nome, codigo_produto)',
    )
    .eq('pedido_id', pedidoId)
    .order('criado_em', { ascending: true })
  if (error) throw error
  return ((data ?? []) as any[]).map((i) => ({
    id: i.id,
    produto_id: i.produto_id,
    produto_nome: i.produtos?.nome ?? '—',
    produto_codigo: i.produtos?.codigo_produto != null ? String(i.produtos.codigo_produto) : null,
    quantidade: Number(i.quantidade) || 0,
    qtd_recebida: Number(i.qtd_recebida) || 0,
    custo_unitario: Number(i.custo_unitario) || 0,
    custo_liquido: i.custo_liquido != null ? Number(i.custo_liquido) : null,
    valor_ipi: i.valor_ipi != null ? Number(i.valor_ipi) : null,
    valor_st: i.valor_st != null ? Number(i.valor_st) : null,
    valor_outras_despesas: i.valor_outras_despesas != null ? Number(i.valor_outras_despesas) : null,
  }))
}

export interface EditarPedidoItem {
  pedido_item_id: string
  quantidade?: number
  custo_unitario?: number
  custo_liquido?: number | null
  valor_ipi?: number | null
  valor_st?: number | null
  valor_outras_despesas?: number | null
  remover?: boolean
}

export interface EditarPedidoInput {
  pedido_id: string
  itens: EditarPedidoItem[]
  data_prevista_entrega: string | null
  condicoes_pagamento: string | null
  observacao: string | null
  desconto_percentual: number | null
  empresa_id: string | null
  local_entrega: string | null
}

export async function editarPedidoCompra(
  input: EditarPedidoInput,
): Promise<{ valor_total: number; parcelas_criadas: number }> {
  const { data, error } = await (supabase as any).rpc('editar_pedido_compra', {
    p_pedido_id: input.pedido_id,
    p_itens: input.itens,
    p_data_prevista_entrega: input.data_prevista_entrega || null,
    p_condicoes_pagamento: input.condicoes_pagamento?.trim() || null,
    p_observacao: input.observacao?.trim() || null,
    p_desconto_percentual: input.desconto_percentual || null,
    p_empresa_id: input.empresa_id || null,
    p_local_entrega: input.local_entrega?.trim() || null,
  })
  if (error) throw error
  return data
}

/** E: quantidade que chegou de cada item; o status do pedido muda sozinho. Não mexe em estoque. */
export async function registrarEntradaPedidoCompra(
  pedidoId: string,
  itens: { pedido_item_id: string; quantidade: number }[],
): Promise<{ status: string }> {
  const { data, error } = await (supabase as any).rpc('registrar_entrada_pedido_compra', {
    p_pedido_id: pedidoId,
    p_itens: itens,
  })
  if (error) throw error
  return data
}

/** C4: prazo médio (dias) entre o pedido e a primeira entrada, nos pedidos já recebidos do fornecedor. */
export async function getPrazoMedioFornecedor(
  fornecedorId: string,
): Promise<{ dias: number; pedidos: number } | null> {
  if (!fornecedorId) return null
  const { data, error } = await (supabase as any).rpc('prazo_medio_entrega_fornecedor', {
    p_fornecedor_id: fornecedorId,
  })
  if (error || !data || !data.pedidos) return null
  return { dias: Number(data.dias) || 0, pedidos: Number(data.pedidos) || 0 }
}

export interface PedidoChegando {
  id: string
  numero: string
  status: string
  data_prevista_entrega: string
  fornecedor_nome: string
}

function dataIso(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** C3: pedidos em aberto com entrega prevista de hoje até daqui a `dias` dias. */
export async function getPedidosChegando(dias = 10): Promise<PedidoChegando[]> {
  const hoje = new Date()
  const ate = new Date(hoje.getTime() + dias * 86400000)
  const { data, error } = await (supabase as any)
    .from('pedidos_compra')
    .select('id, numero, status, data_prevista_entrega, contatos!fornecedor_id(nome)')
    .in('status', STATUS_PEDIDO_COMPRA_ABERTO)
    .gte('data_prevista_entrega', dataIso(hoje))
    .lte('data_prevista_entrega', dataIso(ate))
    .order('data_prevista_entrega', { ascending: true })
  if (error) throw error
  return ((data ?? []) as any[]).map((p) => ({
    id: p.id,
    numero: p.numero,
    status: p.status,
    data_prevista_entrega: p.data_prevista_entrega,
    fornecedor_nome: p.contatos?.nome ?? '—',
  }))
}
