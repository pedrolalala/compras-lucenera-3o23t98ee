import { supabase } from '@/lib/supabase/client'

// SPEC-066 Frente E: "Entrada de Nota Fiscal" (substitui a aba
// "Recebimento", antes placeholder). v1 vincula só ao pedido_compra
// (fornecedor/itens/valor/empresa) — não replica o nível de detalhe
// orçamento/venda/cliente/L do sistema legado que a própria Débora
// sugeriu simplificar (Reunião.05, "talvez isso possa ser repensado...
// seria melhor enxugar um pouco isso").
//
// Tanto o Matheus (recebe fisicamente, anexa PDF/foto na hora) quanto a
// Débora (pega o anexo por e-mail) usam a mesma tela — por isso o
// arquivo é opcional, não obrigatório.

export interface PedidoParaEntrada {
  id: string
  numero: string
  status: string
  fornecedor_nome: string
  empresa_nome: string | null
  valor_total: number | null
  condicoes_pagamento: string | null
  // SPEC-215: fornecedor com CNPJ (pode ser trocado na entrada) e prazos para gerar as parcelas da nota
  fornecedor_id: string
  fornecedor_documento: string | null
  prazo_pagamento_dias: number[] | null
  // SPEC-209 E: id e qtd_recebida para a entrada por item
  itens: Array<{
    id: string
    produto_id: string
    produto_nome: string
    produto_codigo: string | null
    quantidade: number
    qtd_recebida: number
    /** SPEC-215: base da sugestão de valor/ST da nota (por unidade). */
    custo_unitario: number
    valor_st: number
    /** SPEC-220: valores da nota já preenchidos do pedido (por unidade, sem IPI/ST). */
    custo_liquido: number | null
    valor_ipi: number
    valor_icms: number
    /** SPEC-220: L de origem desta linha (sugestão de para quem vai o que chegou). */
    origens: string[]
  }>
}

export async function buscarPedidoPorNumero(numero: string): Promise<PedidoParaEntrada | null> {
  const { data: pedido, error } = await (supabase as any)
    .from('pedidos_compra')
    .select(
      'id, numero, status, valor_total, condicoes_pagamento, prazo_pagamento_dias, fornecedor_id, contatos!fornecedor_id(nome, cnpj, cpf_cnpj), empresas(nome)',
    )
    .ilike('numero', numero.trim())
    .maybeSingle()

  if (error) throw error
  if (!pedido) return null

  const { data: itens } = await (supabase as any)
    .from('pedido_compra_itens')
    .select(
      'id, produto_id, quantidade, qtd_recebida, custo_unitario, custo_liquido, valor_ipi, valor_icms, valor_st, produtos(nome, codigo_produto), pedido_compra_item_origem(projeto_item_id)',
    )
    .eq('pedido_id', pedido.id)
    .order('criado_em', { ascending: true })

  return {
    id: pedido.id,
    numero: pedido.numero,
    status: pedido.status,
    fornecedor_nome: pedido.contatos?.nome ?? '—',
    empresa_nome: pedido.empresas?.nome ?? null,
    valor_total: pedido.valor_total,
    condicoes_pagamento: pedido.condicoes_pagamento,
    fornecedor_id: pedido.fornecedor_id,
    fornecedor_documento: soDigitos(pedido.contatos?.cnpj || pedido.contatos?.cpf_cnpj),
    prazo_pagamento_dias: pedido.prazo_pagamento_dias ?? null,
    itens: ((itens ?? []) as any[]).map((i) => ({
      id: i.id,
      produto_id: i.produto_id,
      produto_nome: i.produtos?.nome ?? '—',
      produto_codigo: i.produtos?.codigo_produto ? String(i.produtos.codigo_produto) : null,
      quantidade: Number(i.quantidade) || 0,
      qtd_recebida: Number(i.qtd_recebida) || 0,
      custo_unitario: Number(i.custo_unitario) || 0,
      valor_st: Number(i.valor_st) || 0,
      custo_liquido: i.custo_liquido != null ? Number(i.custo_liquido) : null,
      valor_ipi: Number(i.valor_ipi) || 0,
      valor_icms: Number(i.valor_icms) || 0,
      origens: ((i.pedido_compra_item_origem ?? []) as any[]).map((o) => o.projeto_item_id).filter(Boolean),
    })),
  }
}

// SPEC-220: vendas/L que esperam cada peça (entrega futura) — destino do que chegou na entrada.
export interface EntregaFutura {
  projeto_item_id: string
  produto_id: string
  venda_numero: string | null
  orcamento_numero: string | null
  projeto_codigo: string | null
  cliente_nome: string
  l_fixo: string | null
  empresa_nome: string | null
  q_entrega_futura: number
}

export async function getEntregasFuturas(produtoIds: string[]): Promise<EntregaFutura[]> {
  if (produtoIds.length === 0) return []
  const { data, error } = await (supabase as any).rpc('entregas_futuras_para_entrada', {
    p_produto_ids: produtoIds,
  })
  if (error) throw error
  return ((data ?? []) as any[]).map((e) => ({ ...e, q_entrega_futura: Number(e.q_entrega_futura) || 0 }))
}

// SPEC-220: espelho da entrada (para o Mateus): nota, itens, para quem foi e financeiro.
export interface EspelhoEntrada {
  nota: {
    id: string
    numero_nf: string
    chave_acesso: string | null
    data_emissao: string | null
    data_entrega: string | null
    data_entrada: string | null
    valor: number
    valor_st: number | null
    valor_desconto: number | null
    valor_despesas_acessorias: number | null
    observacao: string | null
    cancelada_em: string | null
    criado_em: string
    pedido_numero: string | null
    fornecedor_nome: string | null
    fornecedor_documento: string | null
    empresa_nome: string | null
    apropriacao: string | null
    lancado_por: string | null
  }
  itens: Array<{
    produto_id: string
    codigo: number | null
    produto: string
    quantidade: number
    valor_unitario: number | null
    valor_ipi: number | null
    valor_st: number | null
  }>
  vinculos: Array<{
    produto_id: string
    quantidade: number
    venda_numero: string | null
    orcamento_numero: string | null
    cliente_nome: string | null
    l_fixo: string | null
    projeto_codigo: string | null
  }>
  parcelas: Array<{ numero: number; vencimento: string; valor: number }>
  antecipacao: number
}

export async function getEspelhoEntrada(notaId: string): Promise<EspelhoEntrada> {
  const { data, error } = await (supabase as any).rpc('espelho_entrada_nota_compra', { p_nota_id: notaId })
  if (error) throw error
  return data as EspelhoEntrada
}

function soDigitos(v: string | null | undefined): string | null {
  const d = (v ?? '').replace(/\D/g, '')
  return d || null
}

/** SPEC-215: 14 dígitos = CNPJ, 11 = CPF; outro tamanho volta como veio. */
export function formatarDocumento(doc: string | null | undefined): string {
  const d = (doc ?? '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return doc ?? ''
}

export async function getDocumentoFornecedor(fornecedorId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from('contatos')
    .select('cnpj, cpf_cnpj')
    .eq('id', fornecedorId)
    .maybeSingle()
  return soDigitos(data?.cnpj || data?.cpf_cnpj)
}

// SPEC-215: vencimentos pela condição do pedido ("30/60/90" = dias; "15/11 e 15/12" = datas), a mesma
// regra do banco que gera as parcelas do pedido ao aprovar.
export async function datasDasParcelas(
  condicoes: string | null,
  prazoDias: number[] | null,
  base: string,
): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc('_lucenera_datas_parcelas', {
    p_condicoes: condicoes ?? '',
    p_prazo_dias: prazoDias,
    p_base: base,
  })
  if (error) throw error
  return (data ?? []) as string[]
}

// SPEC-215: pagamento antecipado (lançado na Adm. Bancária) com saldo para este pedido/fornecedor.
export interface AntecipacaoEntrada {
  id: string
  fornecedor_nome: string
  empresa_nome: string
  pedido_numero: string | null
  data_pagamento: string
  valor: number
  saldo: number
  observacao: string | null
}

export async function getAntecipacoesParaEntrada(
  pedidoId: string,
  fornecedorId?: string | null,
): Promise<AntecipacaoEntrada[]> {
  const { data, error } = await (supabase as any).rpc('antecipacoes_para_entrada', {
    p_pedido_id: pedidoId,
    p_fornecedor_id: fornecedorId ?? null,
  })
  if (error) throw error
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    valor: Number(a.valor) || 0,
    saldo: Number(a.saldo) || 0,
  }))
}

export interface RegistrarEntradaNotaInput {
  pedido_id: string
  /** SPEC-220: valores da nota por unidade (sem IPI/ST no valor_unitario). */
  itens: Array<{
    pedido_item_id: string
    quantidade: number
    valor_unitario?: number
    valor_ipi?: number
    valor_icms?: number
    valor_st?: number
  }>
  numero_nf: string
  data_emissao: string | null
  valor: number
  valor_st: number | null
  observacao: string | null
  arquivo: File | null
  parcelas: Array<{ data_vencimento: string; valor: number }>
  antecipacoes: Array<{ pagamento_id: string; valor: number }>
  /** Fornecedor da nota quando é outro: o pedido passa a ser dele. */
  fornecedor_id: string | null
  // SPEC-220
  chave_acesso: string | null
  data_entrega: string | null
  data_entrada: string | null
  valor_desconto: number | null
  valor_despesas_acessorias: number | null
  /** O que chegou de cada peça vai da entrega futura para a reserva destes L. */
  vinculos: Array<{ produto_id: string; projeto_item_id: string; quantidade: number }>
}

// SPEC-215/220: quantidades + nota + parcelas + antecipação + vínculo com o cliente numa transação só.
export async function registrarEntradaNotaCompra(input: RegistrarEntradaNotaInput): Promise<{
  status: string
  nota_id: string
  parcelas: number
  antecipacao_aplicada: number
  fornecedor_trocado: boolean
  reservado: number
}> {
  const arquivoUrl = input.arquivo
    ? await uploadArquivoNotaFiscalCompra(input.arquivo, input.pedido_id)
    : null
  const { data, error } = await (supabase as any).rpc('registrar_entrada_nota_compra', {
    p_pedido_id: input.pedido_id,
    p_itens: input.itens,
    p_nota: {
      numero_nf: input.numero_nf.trim(),
      data_emissao: input.data_emissao,
      valor: input.valor,
      valor_st: input.valor_st,
      arquivo_url: arquivoUrl,
      observacao: input.observacao?.trim() || null,
      chave_acesso: input.chave_acesso,
      data_entrega: input.data_entrega,
      data_entrada: input.data_entrada,
      valor_desconto: input.valor_desconto,
      valor_despesas_acessorias: input.valor_despesas_acessorias,
    },
    p_parcelas: input.parcelas,
    p_antecipacoes: input.antecipacoes,
    p_fornecedor_id: input.fornecedor_id,
    p_vinculos: input.vinculos,
  })
  if (error) throw error
  return data
}

export async function uploadArquivoNotaFiscalCompra(file: File, pedidoId: string): Promise<string> {
  const safeName = file.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
  const filePath = `${pedidoId}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from('notas_fiscais_compra')
    .upload(filePath, file, { contentType: file.type || 'application/pdf', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('notas_fiscais_compra').getPublicUrl(filePath)
  return data.publicUrl
}

export interface CriarNotaFiscalCompraInput {
  // SPEC-088: entrada avulsa (sem pedido de compra) informa
  // fornecedor_id/empresa_id direto em vez de pedido_compra_id — a tabela
  // exige pedido_compra_id OU fornecedor_id preenchido (CHECK constraint).
  pedido_compra_id?: string | null
  fornecedor_id?: string | null
  empresa_id?: string | null
  produto_id?: string | null
  numero_nf: string
  data_emissao?: string | null
  valor?: number | null
  observacao?: string | null
  arquivo?: File | null
}

export async function criarNotaFiscalCompra(input: CriarNotaFiscalCompraInput): Promise<void> {
  let arquivoUrl: string | null = null
  if (input.arquivo) {
    // upload usa o pedido como pasta quando existe; entrada avulsa usa
    // "avulsa" como pasta (arquivo isolado, sem pedido pra agrupar).
    arquivoUrl = await uploadArquivoNotaFiscalCompra(
      input.arquivo,
      input.pedido_compra_id || 'avulsa',
    )
  }

  const { data: userData } = await supabase.auth.getUser()

  const { error } = await (supabase as any).from('notas_fiscais_compra').insert({
    pedido_compra_id: input.pedido_compra_id || null,
    fornecedor_id: input.fornecedor_id || null,
    empresa_id: input.empresa_id || null,
    produto_id: input.produto_id || null,
    numero_nf: input.numero_nf.trim(),
    data_emissao: input.data_emissao || null,
    valor: input.valor ?? null,
    observacao: input.observacao?.trim() || null,
    arquivo_url: arquivoUrl,
    criado_por: userData?.user?.id ?? null,
  })
  if (error) throw error
}

export interface NotaFiscalCompraRow {
  id: string
  numero_nf: string
  data_emissao: string | null
  valor: number | null
  arquivo_url: string | null
  observacao: string | null
  criado_em: string
  pedido_numero: string
  fornecedor_nome: string
  empresa_nome: string | null
  // SPEC-088: true quando a entrada não tem pedido de compra vinculado
  // (avulsa) — usado pra sinalizar na listagem.
  avulsa: boolean
  // SPEC-218: entrada cancelada (fica na lista riscada, com o motivo)
  cancelada_em: string | null
  motivo_cancelamento: string | null
}

export async function getNotasFiscaisCompra(searchTerm?: string): Promise<NotaFiscalCompraRow[]> {
  let query = (supabase as any)
    .from('notas_fiscais_compra')
    .select(
      '*, pedidos_compra(numero, empresas(nome), contatos!fornecedor_id(nome)), fornecedor:contatos!fornecedor_id(nome), empresa:empresas!empresa_id(nome)',
    )
    .order('criado_em', { ascending: false })
    .limit(200)

  if (searchTerm && searchTerm.trim()) {
    query = query.ilike('numero_nf', `%${searchTerm.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    numero_nf: d.numero_nf,
    data_emissao: d.data_emissao,
    valor: d.valor,
    arquivo_url: d.arquivo_url,
    observacao: d.observacao,
    criado_em: d.criado_em,
    pedido_numero: d.pedidos_compra?.numero ?? '—',
    fornecedor_nome: d.pedidos_compra?.contatos?.nome ?? d.fornecedor?.nome ?? '—',
    empresa_nome: d.pedidos_compra?.empresas?.nome ?? d.empresa?.nome ?? null,
    avulsa: !d.pedido_compra_id,
    cancelada_em: d.cancelada_em ?? null,
    motivo_cancelamento: d.motivo_cancelamento ?? null,
  }))
}

// SPEC-218: desfaz a entrada (quantidade recebida, status do pedido, parcelas no A Pagar e antecipação usada).
export async function cancelarEntradaNotaCompra(
  notaId: string,
  motivo: string,
): Promise<{
  pedido_numero: string | null
  pedido_status: string | null
  antecipacao_devolvida: number
  /** SPEC-220: quanto voltou da reserva para a entrega futura. */
  reserva_desfeita?: number
}> {
  const { data, error } = await (supabase as any).rpc('cancelar_entrada_nota_compra', {
    p_nota_id: notaId,
    p_motivo: motivo.trim(),
  })
  if (error) throw error
  return data
}

// SPEC-088: busca leve de produto pra vínculo opcional na entrada avulsa —
// a Débora pode deixar em branco e linkar depois editando a nota.
export interface ProdutoBusca {
  id: string
  nome: string
  codigo_produto: number | null
}

export async function buscarProdutosParaEntrada(termo: string): Promise<ProdutoBusca[]> {
  const trimmed = termo.trim()
  if (!trimmed) return []
  // SPEC-116: multi-termo em qualquer ordem — cada palavra digitada
  // precisa casar em nome ou referência (não precisa ser o mesmo
  // campo). Encadear .or() por termo faz o PostgREST AND-ar os grupos.
  let query = (supabase as any).from('produtos').select('id, nome, codigo_produto').limit(20)
  trimmed
    .split(/\s+/)
    .filter(Boolean)
    .forEach((term) => {
      query = query.or(`nome.ilike.%${term}%,referencia.ilike.%${term}%`)
    })
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ProdutoBusca[]
}
