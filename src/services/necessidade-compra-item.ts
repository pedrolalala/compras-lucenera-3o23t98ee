import { supabase } from '@/lib/supabase/client'

// Granularidade real: 1 linha por projeto_item_id (1:1 com
// orcamento_item_id), em vez de agregada por produto_id como
// vw_necessidade_compra (services/necessidade-compra.ts — não tocado por
// este arquivo).
export interface NecessidadeCompraItemRow {
  projeto_item_id: string
  produto_id: string
  produto: string
  produto_codigo: string | null
  orcamento_id: string | null
  orcamento_numero: string | null
  orcamento_item_id: string
  // "L Fixo" — posição/linha do orçamento de origem
  // (orcamento_itens.custom_id, snapshotado em projeto_itens.l_fixo).
  // NULL quando o item de orçamento de origem não tinha custom_id
  // preenchido (decisão do usuário P-04: linha própria, "—" na coluna).
  l_fixo: string | null
  preco_custo: number | null
  percentual_desconto_compra: number | null
  marca_id: string | null
  marca_nome: string | null
  fornecedor_id: string | null
  fornecedor_nome: string | null
  q_entrega_futura: number
  qtd_coberta_por_pedido_aberto: number
  pendente_item: number
}

// SPEC-103 (parte 1): a granularidade por L Fixo, antes numa aba separada
// ("Por Item de Orçamento", SPEC-040), agora vive dentro do card lateral de
// "Por Produto" (components/necessidade/NecessidadeDetailsPanel.tsx) —
// escopada a um produto_id por vez, não busca livre entre todos os
// produtos. `fornecedor_id` é resolvido por produto/marca (mesma cascata de
// vw_necessidade_compra), então é sempre igual entre as linhas retornadas
// aqui — não há necessidade de checar "fornecedor diferente" como no Fluxo A.
export async function getNecessidadeCompraItemPorProduto(
  produtoId: string,
): Promise<NecessidadeCompraItemRow[]> {
  const { data, error } = await (supabase as any)
    .from('vw_necessidade_compra_item_orcamento')
    .select('*')
    .eq('produto_id', produtoId)
    .order('orcamento_numero', { ascending: true })
    .order('l_fixo', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data as NecessidadeCompraItemRow[]) ?? []
}
