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
  let query = (supabase as any)
    .from('contatos')
    .select('id, nome, contato_tipos!inner(tipo)')
    .eq('ativo', true)
    .eq('contato_tipos.tipo', 'fornecedor')
  if (search && search.trim()) query = query.ilike('nome', `%${search.trim()}%`)
  const { data, error } = await query.order('nome').limit(50)
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({ id: d.id, nome: d.nome })) as Fornecedor[]
}
