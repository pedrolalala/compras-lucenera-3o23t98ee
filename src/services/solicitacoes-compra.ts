import { supabase } from '@/lib/supabase/client'

// SPEC-066 Frente F: aba "Solicitações" = "Aprovar Necessidade de
// Compra" (Reunião.02/04). Passo OPCIONAL entre Necessidade de Compra e
// Pedido de Compra — coexiste com "Fechar Pedido em Lote" (P-F2).
// Não confundir com public.solicitacoes_compra (log interno criado
// junto do pedido) — esta usa public.solicitacoes_aprovacao_compra.

export interface EmpresaSimples {
  id: string
  nome: string
}

export async function getEmpresasSimples(): Promise<EmpresaSimples[]> {
  const { data, error } = await (supabase as any).from('empresas').select('id, nome').order('nome')
  if (error) throw error
  return (data ?? []) as EmpresaSimples[]
}

export interface CriarSolicitacaoInput {
  produto_id: string
  marca_id?: string | null
  fornecedor_id?: string | null
  empresa_id?: string | null
  perfil?: string | null
  quantidade: number
  cliente_id?: string | null
  observacao?: string | null
}

export async function criarSolicitacaoCompra(input: CriarSolicitacaoInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await (supabase as any).from('solicitacoes_aprovacao_compra').insert({
    produto_id: input.produto_id,
    marca_id: input.marca_id ?? null,
    fornecedor_id: input.fornecedor_id ?? null,
    empresa_id: input.empresa_id ?? null,
    perfil: input.perfil ?? null,
    quantidade: input.quantidade,
    cliente_id: input.cliente_id ?? null,
    observacao: input.observacao ?? null,
    criado_por: userData?.user?.id ?? null,
  })
  if (error) throw error
}

export interface SolicitacaoCompraRow {
  id: string
  produto_id: string
  produto_nome: string
  produto_codigo: string | null
  marca_id: string | null
  marca_nome: string | null
  fornecedor_id: string | null
  fornecedor_nome: string | null
  empresa_id: string | null
  empresa_nome: string | null
  perfil: string | null
  quantidade: number
  custo_unitario: number | null
  condicao_pagamento: string | null
  data_prevista_entrega: string | null
  observacao: string | null
  status: string
  pedido_compra_id: string | null
  criado_em: string
}

export async function getSolicitacoesCompra(status?: string): Promise<SolicitacaoCompraRow[]> {
  let query = (supabase as any)
    .from('solicitacoes_aprovacao_compra')
    .select(
      '*, produtos(nome, codigo_produto), marcas(nome), contatos!fornecedor_id(nome), empresas(nome)',
    )
    .order('criado_em', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    produto_id: d.produto_id,
    produto_nome: d.produtos?.nome ?? '—',
    produto_codigo: d.produtos?.codigo_produto ? String(d.produtos.codigo_produto) : null,
    marca_id: d.marca_id,
    marca_nome: d.marcas?.nome ?? null,
    fornecedor_id: d.fornecedor_id,
    fornecedor_nome: d.contatos?.nome ?? null,
    empresa_id: d.empresa_id,
    empresa_nome: d.empresas?.nome ?? null,
    perfil: d.perfil,
    quantidade: d.quantidade,
    custo_unitario: d.custo_unitario,
    condicao_pagamento: d.condicao_pagamento,
    data_prevista_entrega: d.data_prevista_entrega,
    observacao: d.observacao,
    status: d.status,
    pedido_compra_id: d.pedido_compra_id,
    criado_em: d.criado_em,
  }))
}

export interface AtualizarSolicitacaoInput {
  fornecedor_id?: string | null
  empresa_id?: string | null
  perfil?: string | null
  quantidade?: number
  custo_unitario?: number | null
  condicao_pagamento?: string | null
  data_prevista_entrega?: string | null
  observacao?: string | null
}

export async function atualizarSolicitacaoCompra(
  id: string,
  patch: AtualizarSolicitacaoInput,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('solicitacoes_aprovacao_compra')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

export async function aprovarSolicitacaoCompra(
  id: string,
  custoUnitario?: number | null,
  numero?: string | null,
): Promise<{ pedido_compra_id: string }> {
  const { data, error } = await (supabase as any).rpc('aprovar_solicitacao_compra', {
    p_solicitacao_id: id,
    p_custo_unitario: custoUnitario ?? null,
    p_numero: numero ?? null,
  })
  if (error) throw error
  return data
}

export async function rejeitarSolicitacaoCompra(id: string, motivo?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('rejeitar_solicitacao_compra', {
    p_solicitacao_id: id,
    p_motivo: motivo ?? null,
  })
  if (error) throw error
}
