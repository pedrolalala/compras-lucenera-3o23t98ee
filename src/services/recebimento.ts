import { supabase } from '@/lib/supabase/client'
import type { PedidoRow, PedidoItemRow } from './compras'
import { mockPedidos, mockPedidoItens } from './compras-mock'

export async function getPedidosRecebimento(): Promise<PedidoRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('pedidos_compra')
      .select('*, contatos!fornecedor_id(nome)')
      .in('status', ['enviado', 'parcialmente_recebido'])
      .order('data_emissao', { ascending: false })
    if (error) throw error
    if (data && data.length > 0) {
      return data.map((d: any) => ({
        ...d,
        fornecedor_nome: d.contatos?.nome ?? '-',
      })) as PedidoRow[]
    }
    return mockPedidos.filter((p) => p.status === 'enviado' || p.status === 'parcialmente_recebido')
  } catch {
    return mockPedidos.filter((p) => p.status === 'enviado' || p.status === 'parcialmente_recebido')
  }
}

export async function getItensRecebimento(pedidoId: string): Promise<PedidoItemRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('pedido_compra_itens')
      .select('*, produtos(nome)')
      .eq('pedido_id', pedidoId)
    if (error) throw error
    if (data && data.length > 0) {
      return data.map((d: any) => ({
        ...d,
        produto_nome: d.produtos?.nome ?? '-',
      })) as PedidoItemRow[]
    }
    return mockPedidoItens[pedidoId] ?? []
  } catch {
    return mockPedidoItens[pedidoId] ?? []
  }
}

export interface RecebimentoItemInput {
  pedido_item_id: string
  quantidade_recebida: number
  divergencia?: string
}

export async function registrarRecebimento(
  pedidoId: string,
  numeroNota: string,
  data: string,
  itens: RecebimentoItemInput[],
): Promise<{ success: boolean; message: string }> {
  try {
    const { data: result, error } = await supabase.rpc('registrar_recebimento_compra' as any, {
      p_pedido_id: pedidoId,
      p_numero_nota: numeroNota,
      p_data: data,
      p_itens: itens,
    })
    if (error) throw error
    const r = result as { success: boolean; message: string }
    return r ?? { success: true, message: 'Recebimento registrado.' }
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'Erro ao registrar recebimento.' }
  }
}
