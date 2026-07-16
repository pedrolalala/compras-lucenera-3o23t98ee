import { supabase } from '@/lib/supabase/client'
import {
  mockSolicitacoes,
  mockCotacoes,
  mockCotacaoItens,
  mockPedidos,
  mockPedidoItens,
  mockProdutos,
} from './compras-mock'

export interface SolicitacaoRow {
  id: string
  produto_id: string
  produto_nome: string
  produto_codigo: number | null
  quantidade: number
  prioridade: string
  observacao: string | null
  status: string
  criado_em: string
}
export interface CotacaoRow {
  id: string
  numero: string | null
  fornecedor_id: string
  fornecedor_nome: string
  status: string
  validade: string | null
  condicoes_pagamento: string | null
  observacao: string | null
  criado_em: string
}
export interface CotacaoItemRow {
  id: string
  cotacao_id: string
  produto_id: string
  produto_nome: string
  quantidade: number
  custo_unitario: number
  prazo_entrega_dias: number | null
}
export interface PedidoRow {
  id: string
  numero: string | null
  fornecedor_id: string
  fornecedor_nome: string
  status: string
  data_emissao: string | null
  data_prevista_entrega: string | null
  valor_total: number | null
  condicoes_pagamento: string | null
}
export interface PedidoItemRow {
  id: string
  pedido_id: string
  produto_id: string
  produto_nome: string
  quantidade: number
  qtd_recebida: number
  custo_unitario: number
}
export interface ProdutoOption {
  id: string
  nome: string
  codigo_produto: number | null
}

export async function getSolicitacoes(): Promise<SolicitacaoRow[]> {
  const { data, error } = await (supabase as any)
    .from('solicitacoes_compra')
    .select('*, produtos(nome, codigo_produto)')
    .order('criado_em', { ascending: false })
  if (error || !data?.length) return mockSolicitacoes
  return data.map((d: any) => ({
    ...d,
    produto_nome: d.produtos?.nome ?? '-',
    produto_codigo: d.produtos?.codigo_produto ?? null,
  })) as SolicitacaoRow[]
}
export async function criarSolicitacao(
  produtoId: string,
  quantidade: number,
  prioridade: string,
  observacao: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('criar_solicitacao_compra' as any, {
    p_produto_id: produtoId,
    p_quantidade: quantidade,
    p_prioridade: prioridade,
    p_observacao: observacao || null,
  })
  return error ? { success: false, error: error.message } : { success: true }
}
export async function atualizarSolicitacao(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('atualizar_status_solicitacao' as any, {
    p_id: id,
    p_status: status,
  })
  return error ? { success: false, error: error.message } : { success: true }
}
export async function getCotacoes(): Promise<CotacaoRow[]> {
  const { data, error } = await (supabase as any)
    .from('cotacoes_compra')
    .select('*, contatos!fornecedor_id(nome)')
    .order('criado_em', { ascending: false })
  if (error || !data?.length) return mockCotacoes
  return data.map((d: any) => ({ ...d, fornecedor_nome: d.contatos?.nome ?? '-' })) as CotacaoRow[]
}
export async function criarCotacao(
  fornecedorId: string,
  validade: string,
  condicoes: string,
  observacao: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('criar_cotacao_compra' as any, {
    p_fornecedor_id: fornecedorId,
    p_validade: validade || null,
    p_condicoes_pagamento: condicoes || null,
    p_observacao: observacao || null,
  })
  return error ? { success: false, error: error.message } : { success: true, id: data as string }
}
export async function getCotacaoItens(cotacaoId: string): Promise<CotacaoItemRow[]> {
  const { data, error } = await (supabase as any)
    .from('cotacao_itens')
    .select('*, produtos(nome)')
    .eq('cotacao_id', cotacaoId)
  if (error || !data?.length) return mockCotacaoItens[cotacaoId] ?? []
  return data.map((d: any) => ({ ...d, produto_nome: d.produtos?.nome ?? '-' })) as CotacaoItemRow[]
}
export async function adicionarItemCotacao(
  cotacaoId: string,
  solicitacaoId: string,
  produtoId: string,
  quantidade: number,
  custo: number,
  prazo: number,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('adicionar_item_cotacao' as any, {
    p_cotacao_id: cotacaoId,
    p_solicitacao_id: solicitacaoId,
    p_produto_id: produtoId,
    p_quantidade: quantidade,
    p_custo_unitario: custo,
    p_prazo_entrega_dias: prazo || null,
  })
  return error ? { success: false, error: error.message } : { success: true }
}
export async function atualizarCotacao(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('atualizar_status_cotacao' as any, {
    p_id: id,
    p_status: status,
  })
  return error ? { success: false, error: error.message } : { success: true }
}
export async function getPedidos(): Promise<PedidoRow[]> {
  const { data, error } = await (supabase as any)
    .from('pedidos_compra')
    .select('*, contatos!fornecedor_id(nome)')
    .order('data_emissao', { ascending: false })
  if (error || !data?.length) return mockPedidos
  return data.map((d: any) => ({ ...d, fornecedor_nome: d.contatos?.nome ?? '-' })) as PedidoRow[]
}
export async function criarPedido(
  fornecedorId: string,
  cotacaoId: string | null,
  condicoes: string,
  observacao: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('criar_pedido_compra' as any, {
    p_fornecedor_id: fornecedorId,
    p_cotacao_id: cotacaoId || null,
    p_condicoes_pagamento: condicoes || null,
    p_observacao: observacao || null,
  })
  return error ? { success: false, error: error.message } : { success: true, id: data as string }
}
export async function getPedidoItens(pedidoId: string): Promise<PedidoItemRow[]> {
  const { data, error } = await (supabase as any)
    .from('pedido_compra_itens')
    .select('*, produtos(nome)')
    .eq('pedido_id', pedidoId)
  if (error || !data?.length) return mockPedidoItens[pedidoId] ?? []
  return data.map((d: any) => ({ ...d, produto_nome: d.produtos?.nome ?? '-' })) as PedidoItemRow[]
}
export async function adicionarItemPedido(
  pedidoId: string,
  produtoId: string,
  quantidade: number,
  custo: number,
  solicitacaoId?: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('adicionar_item_pedido' as any, {
    p_pedido_id: pedidoId,
    p_solicitacao_id: solicitacaoId || null,
    p_produto_id: produtoId,
    p_quantidade: quantidade,
    p_custo_unitario: custo,
  })
  return error ? { success: false, error: error.message } : { success: true }
}
export async function atualizarStatusPedido(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('atualizar_status_pedido' as any, {
    p_id: id,
    p_status: status,
  })
  return error ? { success: false, error: error.message } : { success: true }
}
export async function getProdutos(): Promise<ProdutoOption[]> {
  const { data, error } = await (supabase as any)
    .from('produtos')
    .select('id, nome, codigo_produto')
    .eq('ativo', true)
    .order('nome')
  if (error || !data?.length) return mockProdutos
  return data as ProdutoOption[]
}
