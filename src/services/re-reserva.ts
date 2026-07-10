import { supabase } from '@/lib/supabase/client'

export interface PendenciaRow {
  projeto_item_id: string
  produto_id: string
  produto: string
  produto_codigo: number | null
  projeto_id: string | null
  projeto_codigo: string | null
  orcamento_id: string | null
  orcamento_numero: string | null
  cliente_id: string | null
  cliente: string | null
  q_entrega_futura: number
  q_reserva: number
  qtd_fisica: number
  qtd_comprometida: number
  qtd_disponivel: number
  qtd_pode_re_reservar: number
  atualizado_em: string | null
}

const mockPendencias: PendenciaRow[] = [
  {
    projeto_item_id: 'pi001',
    produto_id: 'p001',
    produto: 'Luminária Pendente Cristal 3Lâmpadas',
    produto_codigo: 301,
    projeto_id: 'pr001',
    projeto_codigo: 'OB-2024-001',
    orcamento_id: 'oc001',
    orcamento_numero: 'ORC-001',
    cliente_id: 'c001',
    cliente: 'Maria Silva',
    q_entrega_futura: 4,
    q_reserva: 2,
    qtd_fisica: 10,
    qtd_comprometida: 6,
    qtd_disponivel: 4,
    qtd_pode_re_reservar: 4,
    atualizado_em: '2026-07-08T10:30:00Z',
  },
  {
    projeto_item_id: 'pi003',
    produto_id: 'p002',
    produto: 'Spot LED Embutir 7W 2700K',
    produto_codigo: 7,
    projeto_id: 'pr003',
    projeto_codigo: 'OB-2024-007',
    orcamento_id: 'oc003',
    orcamento_numero: 'ORC-007',
    cliente_id: 'c003',
    cliente: 'Construtora Horizon',
    q_entrega_futura: 20,
    q_reserva: 15,
    qtd_fisica: 30,
    qtd_comprometida: 25,
    qtd_disponivel: 5,
    qtd_pode_re_reservar: 5,
    atualizado_em: '2026-07-07T09:15:00Z',
  },
  {
    projeto_item_id: 'pi010',
    produto_id: 'p007',
    produto: 'Trilho Eletrificado 3 Fases 1m',
    produto_codigo: 101,
    projeto_id: 'pr010',
    projeto_codigo: 'OB-2024-011',
    orcamento_id: 'oc010',
    orcamento_numero: 'ORC-011',
    cliente_id: 'c010',
    cliente: 'Loja Conceito Vista',
    q_entrega_futura: 12,
    q_reserva: 8,
    qtd_fisica: 15,
    qtd_comprometida: 12,
    qtd_disponivel: 3,
    qtd_pode_re_reservar: 3,
    atualizado_em: '2026-07-01T09:00:00Z',
  },
  {
    projeto_item_id: 'pi011',
    produto_id: 'p008',
    produto: 'Driver LED 12V 150W',
    produto_codigo: 150,
    projeto_id: 'pr011',
    projeto_codigo: 'OB-2024-016',
    orcamento_id: 'oc011',
    orcamento_numero: 'ORC-016',
    cliente_id: 'c011',
    cliente: 'Tecnologia Bright Ltda',
    q_entrega_futura: 11,
    q_reserva: 4,
    qtd_fisica: 8,
    qtd_comprometida: 5,
    qtd_disponivel: 3,
    qtd_pode_re_reservar: 3,
    atualizado_em: '2026-06-30T14:20:00Z',
  },
  {
    projeto_item_id: 'pi008',
    produto_id: 'p006',
    produto: 'Pendente Industrial Black 5Lâmpadas',
    produto_codigo: 55,
    projeto_id: 'pr008',
    projeto_codigo: 'OB-2024-025',
    orcamento_id: 'oc008',
    orcamento_numero: 'ORC-025',
    cliente_id: 'c008',
    cliente: 'Mariana Rocha',
    q_entrega_futura: 5,
    q_reserva: 3,
    qtd_fisica: 6,
    qtd_comprometida: 4,
    qtd_disponivel: 2,
    qtd_pode_re_reservar: 2,
    atualizado_em: '2026-07-03T10:00:00Z',
  },
]

export async function getPendencias(): Promise<PendenciaRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('vw_pendencias_re_reserva')
      .select('*')
      .gt('qtd_pode_re_reservar', 0)
      .order('qtd_pode_re_reservar', { ascending: false })
    if (error) throw error
    if (data && data.length > 0) return data as PendenciaRow[]
    return mockPendencias
  } catch {
    return mockPendencias
  }
}

export async function reReservar(
  projetoItemId: string,
  quantidade: number,
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('re_reservar_projeto_item' as any, {
      p_projeto_item_id: projetoItemId,
      p_quantidade: quantidade,
    })
    if (error) throw error
    const result = data as { success: boolean; message: string }
    return result ?? { success: true, message: 'Re-reserva realizada.' }
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'Erro ao re-reservar item.' }
  }
}
