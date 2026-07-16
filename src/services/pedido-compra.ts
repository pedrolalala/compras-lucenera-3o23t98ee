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
  numero: string
  data_prevista_entrega?: string
  condicoes_pagamento?: string
  observacao?: string
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
    p_numero: input.numero,
    p_data_prevista_entrega: input.data_prevista_entrega ?? null,
    p_condicoes_pagamento: input.condicoes_pagamento ?? null,
    p_observacao: input.observacao ?? null,
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
}

export interface CriarPedidoLoteInput {
  fornecedor_id: string
  itens: ItemPedidoLote[]
  numero: string
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
    p_numero: input.numero,
    p_data_prevista_entrega: input.data_prevista_entrega ?? null,
    p_condicoes_pagamento: input.condicoes_pagamento ?? null,
    p_observacao: input.observacao ?? null,
  })
  if (error) throw error
  return data as CriarPedidoLoteResult
}
