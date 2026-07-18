import { supabase } from '@/lib/supabase/client'

// SPEC-033: tela "Marcas" — mapeamento marca -> fornecedor padrão, feito
// pela UI em vez de SQL manual. marcas.fornecedor_id e a policy de UPDATE
// (marcas_update, restrita a usuarios.role IN admin/gerente) já existem e
// já estão aplicadas no Supabase real (migration 20260716_049).

export interface MarcaComFornecedor {
  id: string
  nome: string
  fornecedor_id: string | null
  fornecedor_nome: string | null
  qtd_produtos_ativos: number
}

const BATCH_SIZE = 500

export async function getMarcasComFornecedor(search?: string): Promise<MarcaComFornecedor[]> {
  let query = (supabase as any)
    .from('marcas')
    .select('id, nome, fornecedor_id, fornecedor:contatos(nome)')
    .order('nome', { ascending: true })

  if (search?.trim()) {
    query = query.ilike('nome', `%${search.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error

  const marcas = (data ?? []) as any[]
  const contagem = await contarProdutosAtivosPorMarca()

  return marcas.map((m) => ({
    id: m.id,
    nome: m.nome,
    fornecedor_id: m.fornecedor_id,
    fornecedor_nome: m.fornecedor?.nome ?? null,
    qtd_produtos_ativos: contagem.get(m.id) ?? 0,
  }))
}

// produtos não expõe uma contagem agregada por marca via view — busca
// paginada (mesmo padrão de necessidade-compra.ts/estoque-produtos.ts),
// trazendo só id/marca_id dos produtos ativos para contar client-side.
async function contarProdutosAtivosPorMarca(): Promise<Map<string, number>> {
  const contagem = new Map<string, number>()

  const { count, error: countError } = await (supabase as any)
    .from('produtos')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true)
  if (countError) throw countError

  const total = count ?? 0
  let start = 0

  while (start < total) {
    const end = Math.min(start + BATCH_SIZE - 1, total - 1)
    const { data, error } = await (supabase as any)
      .from('produtos')
      .select('marca_id')
      .eq('ativo', true)
      .range(start, end)
    if (error) throw error

    ;(data ?? []).forEach((p: { marca_id: string | null }) => {
      if (!p.marca_id) return
      contagem.set(p.marca_id, (contagem.get(p.marca_id) ?? 0) + 1)
    })
    start += BATCH_SIZE
  }

  return contagem
}

export async function atualizarFornecedorMarca(
  marcaId: string,
  fornecedorId: string | null,
): Promise<void> {
  // SPEC-033 (correção pós-publicação, 2026-07-18): sem .select() encadeado,
  // o Supabase-js usa `Prefer: return=minimal` — se a policy RLS de UPDATE
  // bloquear a linha (ou o .eq('id', ...) não casar com nada), o PostgREST
  // responde 204 No Content sem erro nenhum, e um UPDATE que afetou 0 linhas
  // parecia sucesso. `.select('id').single()` força o retorno da linha
  // afetada e lança PGRST116 quando 0 linhas voltam, o que tratamos abaixo
  // com uma mensagem legível em vez do erro cru do Postgrest.
  const { data, error } = await (supabase as any)
    .from('marcas')
    .update({ fornecedor_id: fornecedorId })
    .eq('id', marcaId)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      'Nenhuma marca foi atualizada. Verifique se seu usuário tem permissão de admin/gerente.',
    )
  }
}
