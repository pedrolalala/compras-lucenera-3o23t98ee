import { supabase } from '@/lib/supabase/client'

// SPEC-236: leitura/gravação da configuração do Compras (WhatsApp, endereço padrão) e do endereço de entrega
// próprio do fornecedor. A regra (qual endereço vale) fica em @/lib/entrega-pedido.

import {
  entregaDoContato,
  type ComprasConfig,
  type EnderecoEntrega,
} from '@/lib/entrega-pedido'

export * from '@/lib/entrega-pedido'

const vazio = (): EnderecoEntrega => ({
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
})

export async function getComprasConfig(): Promise<ComprasConfig> {
  const { data, error } = await (supabase as any)
    .from('compras_config')
    .select(
      'whatsapp_compras, empresa:empresas(razao_social, nome, logradouro, numero, complemento, bairro, cidade, estado, cep)',
    )
    .maybeSingle()
  if (error) throw error
  const e = data?.empresa
  return {
    whatsapp: data?.whatsapp_compras || null,
    padrao: e
      ? {
          nome: e.razao_social || e.nome || null,
          endereco: {
            logradouro: e.logradouro ?? '',
            numero: e.numero ?? '',
            complemento: e.complemento ?? '',
            bairro: e.bairro ?? '',
            cidade: e.cidade ?? '',
            estado: e.estado ?? '',
            cep: e.cep ?? '',
          },
        }
      : null,
  }
}

/** Endereço de entrega próprio do fornecedor, ou null quando ele usa o padrão do estoque. */
export async function getEntregaFornecedor(fornecedorId: string): Promise<EnderecoEntrega | null> {
  const { data, error } = await (supabase as any)
    .from('contatos')
    .select(
      'endereco_entrega, numero_entrega, complemento_entrega, bairro_entrega, cidade_entrega, estado_entrega, cep_entrega',
    )
    .eq('id', fornecedorId)
    .maybeSingle()
  if (error) throw error
  return entregaDoContato(data)
}

/** null = volta a usar o endereço padrão do estoque. */
export async function salvarEntregaFornecedor(
  fornecedorId: string,
  e: EnderecoEntrega | null,
): Promise<void> {
  const v = e ?? vazio()
  const t = (s: string) => s.trim() || null
  const { data, error } = await (supabase as any)
    .from('contatos')
    .update({
      endereco_entrega: t(v.logradouro),
      numero_entrega: t(v.numero),
      complemento_entrega: t(v.complemento),
      bairro_entrega: t(v.bairro),
      cidade_entrega: t(v.cidade),
      estado_entrega: t(v.estado),
      cep_entrega: t(v.cep),
    })
    .eq('id', fornecedorId)
    .select('id')
  if (error) throw error
  // Sem permissão o RLS não dá erro, só não atualiza nenhuma linha.
  if (!data?.length) throw new Error('Sem permissão para alterar o cadastro do fornecedor.')
}
