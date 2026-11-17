import { supabase } from '@/lib/supabase/client'

// SPEC-299 (Reunião 56, 13/11/2026): pedido de compra ADIANTADO para uma venda que ainda não passou.
// A quantidade do item fica RESERVADA para o projeto (código do projeto): não cobre a necessidade de outras
// vendas, cobre só o projeto quando ele virar venda, e na entrada da NF vem sugerida para ele.

export interface ProjetoReserva {
  projeto_id: string
  projeto_codigo: string
  projeto_nome: string
  cliente_nome: string
  orcamento_numero: string | null
  orcamento_status: string | null
  tem_a_peca: boolean
  qtd_da_peca: number
}

/** Projetos com orçamento ainda não aprovado; com `produtoId`, quem tem a peça vem primeiro. */
export async function buscarProjetosParaReserva(busca: string, produtoId?: string | null): Promise<ProjetoReserva[]> {
  const { data, error } = await (supabase as any).rpc('buscar_projetos_para_reserva', {
    p_busca: busca.trim() || null,
    p_produto_id: produtoId ?? null,
  })
  if (error) throw error
  return ((data ?? []) as any[]).map((p) => ({ ...p, qtd_da_peca: Number(p.qtd_da_peca) || 0 }))
}

export interface ReservaEscolhida {
  projeto_id: string
  projeto_codigo: string
  projeto_nome: string
  cliente_nome: string
  quantidade: number
}

export async function reservarPedidoItemParaProjeto(pedidoItemId: string, projetoId: string, quantidade: number) {
  const { error } = await (supabase as any).rpc('reservar_pedido_item_para_projeto', {
    p_pedido_item: pedidoItemId,
    p_projeto: projetoId,
    p_quantidade: quantidade,
  })
  if (error) throw error
}

export async function liberarDestinoProjeto(destinoId: string, motivo: string) {
  const { error } = await (supabase as any).rpc('liberar_destino_projeto_pedido_item', {
    p_destino: destinoId,
    p_motivo: motivo,
  })
  if (error) throw error
}

export interface DestinoProjetoPedido {
  id: string
  pedido_compra_item_id: string
  produto_id: string
  projeto_id: string
  projeto_codigo: string
  projeto_nome: string
  cliente_nome: string
  quantidade: number
  liberado_em: string | null
  motivo_liberacao: string | null
}

export async function getDestinosProjetoDoPedido(pedidoId: string): Promise<DestinoProjetoPedido[]> {
  const { data, error } = await (supabase as any).rpc('destinos_projeto_do_pedido', { p_pedido_id: pedidoId })
  if (error) throw error
  return ((data ?? []) as any[]).map((d) => ({ ...d, quantidade: Number(d.quantidade) || 0 }))
}

// SPEC-321: venda cancelada com este pedido em andamento — as peças entram no Estoque Geral ao chegar.
export interface AvisoVendaCancelada {
  id: string
  orcamento_numero: string | null
  venda_numero: string | null
  projeto_codigo: string | null
  cliente_nome: string | null
  motivo: string | null
  itens: { produto: string; codigo: string | number | null; quantidade: number }[]
  cancelado_por_nome: string | null
  cancelado_em: string
  visto_em: string | null
}

export async function getAvisosVendaCanceladaDoPedido(pedidoId: string): Promise<AvisoVendaCancelada[]> {
  const { data, error } = await (supabase as any)
    .from('pedido_compra_aviso_cancelamento')
    .select('id, orcamento_numero, venda_numero, projeto_codigo, cliente_nome, motivo, itens, cancelado_por_nome, cancelado_em, visto_em')
    .eq('pedido_id', pedidoId)
    .order('cancelado_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as AvisoVendaCancelada[]
}

export async function marcarAvisoVendaCanceladaVisto(avisoId: string) {
  const { error } = await (supabase as any).rpc('marcar_aviso_cancelamento_visto', { p_aviso: avisoId })
  if (error) throw error
}
