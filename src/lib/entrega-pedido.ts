// SPEC-236: endereço de entrega do pedido de compra — parte sem banco nem navegador (usada no desenho do PDF).
//  - Padrão: a empresa de `compras_config.empresa_entrega_padrao_id` (estoque — FOCO ILUMINAÇÃO LTDA).
//  - Exceção: fornecedor com endereço de entrega próprio no cadastro (campos *_entrega do contato),
//    ex.: Manoella e Islight entregam no showroom.

export interface EnderecoEntrega {
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

export interface EntregaResolvida {
  origem: 'fornecedor' | 'padrao'
  /** razão social de quem recebe (só no padrão; no endereço próprio do fornecedor fica vazio) */
  nome: string | null
  endereco: EnderecoEntrega
}

export interface ComprasConfig {
  whatsapp: string | null
  padrao: { nome: string | null; endereco: EnderecoEntrega } | null
}

export function entregaDoContato(c: any): EnderecoEntrega | null {
  if (!c?.endereco_entrega?.trim()) return null
  return {
    logradouro: c.endereco_entrega ?? '',
    numero: c.numero_entrega ?? '',
    complemento: c.complemento_entrega ?? '',
    bairro: c.bairro_entrega ?? '',
    cidade: c.cidade_entrega ?? '',
    estado: c.estado_entrega ?? '',
    cep: c.cep_entrega ?? '',
  }
}

export function resolverEntrega(
  doFornecedor: EnderecoEntrega | null,
  config: ComprasConfig | null,
): EntregaResolvida | null {
  if (doFornecedor) return { origem: 'fornecedor', nome: null, endereco: doFornecedor }
  if (config?.padrao) return { origem: 'padrao', nome: config.padrao.nome, endereco: config.padrao.endereco }
  return null
}

/** "Rua X, 10 - compl.", "Bairro" e "CEP: 00000-000 - Cidade/UF" (linhas curtas para caber no PDF). */
export function linhasEndereco(e: EnderecoEntrega): string[] {
  const l1 = [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento].filter(Boolean).join(' - ')
  const cidade = [e.cidade, e.estado].filter(Boolean).join('/')
  const l3 = [e.cep && `CEP: ${e.cep}`, cidade].filter(Boolean).join(' - ')
  return [l1, e.bairro, l3].filter(Boolean)
}
