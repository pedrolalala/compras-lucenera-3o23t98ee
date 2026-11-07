import { supabase } from '@/lib/supabase/client'

// SPEC-258 (Financeiro) 4b — pergunta "as parcelas deste pedido já foram pagas?"
// As regras ficam no banco (financeiro_pedido_pergunta / financeiro_responder_pedido_pago); aqui só a chamada.

export interface PerguntaPagamentoPedido {
  pedido_id: string
  status: string
  perguntar: boolean
  parcelas_previstas: { numero: number; vencimento: string; valor: number }[]
}

/** Pedido concluído que ainda tem parcelas previstas e nunca foi respondido => perguntar = true. */
export async function perguntaPagamentoPedido(pedidoId: string): Promise<PerguntaPagamentoPedido> {
  const { data, error } = await (supabase as any).rpc('financeiro_pedido_pergunta', { p_pedido: pedidoId })
  if (error) throw error
  return data as PerguntaPagamentoPedido
}

/** Sim = baixa de pagamento nas parcelas previstas (a conta bancária o Financeiro completa depois); Não = continuam previstas. */
export async function responderPagamentoPedido(
  pedidoId: string,
  pagas: boolean,
  dataPagamento?: string,
  observacao?: string,
): Promise<number> {
  const { data, error } = await (supabase as any).rpc('financeiro_responder_pedido_pago', {
    p_pedido: pedidoId,
    p_pagas: pagas,
    p_data: pagas ? dataPagamento || null : null,
    p_conta: null,
    p_obs: observacao?.trim() || null,
  })
  if (error) throw error
  return Number(data ?? 0)
}
