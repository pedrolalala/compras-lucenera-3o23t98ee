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
  itens: Array<{ produto_nome: string; produto_codigo: string | null; quantidade: number }>
}

export async function buscarPedidoPorNumero(numero: string): Promise<PedidoParaEntrada | null> {
  const { data: pedido, error } = await (supabase as any)
    .from('pedidos_compra')
    .select('id, numero, status, valor_total, condicoes_pagamento, contatos!fornecedor_id(nome), empresas(nome)')
    .ilike('numero', numero.trim())
    .maybeSingle()

  if (error) throw error
  if (!pedido) return null

  const { data: itens } = await (supabase as any)
    .from('pedido_compra_itens')
    .select('quantidade, produtos(nome, codigo_produto)')
    .eq('pedido_id', pedido.id)

  return {
    id: pedido.id,
    numero: pedido.numero,
    status: pedido.status,
    fornecedor_nome: pedido.contatos?.nome ?? '—',
    empresa_nome: pedido.empresas?.nome ?? null,
    valor_total: pedido.valor_total,
    condicoes_pagamento: pedido.condicoes_pagamento,
    itens: ((itens ?? []) as any[]).map((i) => ({
      produto_nome: i.produtos?.nome ?? '—',
      produto_codigo: i.produtos?.codigo_produto ? String(i.produtos.codigo_produto) : null,
      quantidade: i.quantidade,
    })),
  }
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
  }))
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
  // precisa casar em nome, referência ou sku (não precisa ser o mesmo
  // campo). Encadear .or() por termo faz o PostgREST AND-ar os grupos.
  let query = (supabase as any).from('produtos').select('id, nome, codigo_produto').limit(20)
  trimmed
    .split(/\s+/)
    .filter(Boolean)
    .forEach((term) => {
      query = query.or(`nome.ilike.%${term}%,referencia.ilike.%${term}%,sku.ilike.%${term}%`)
    })
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ProdutoBusca[]
}
