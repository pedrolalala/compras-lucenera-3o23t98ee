import { supabase } from '@/lib/supabase/client'

export interface FornecedorPayload {
  nome: string
  nome_empresa?: string | null
  cpf_cnpj?: string | null
  telefone?: string | null
  celular?: string | null
  email?: string | null
  cep?: string | null
  endereco?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  observacoes?: string | null
  ativo?: boolean
}

export interface Fornecedor extends FornecedorPayload {
  id: string
}

// Fornecedor = registro em `contatos` marcado como tipo 'fornecedor'. O
// sistema usa uma tabela auxiliar `contato_tipos` (many-to-many: um
// contato pode ser cliente E fornecedor ao mesmo tempo) além da coluna
// legada `contatos.tipo` (NOT NULL, só o "tipo principal") — a busca fuzzy
// usada no restante do sistema (buscar_fornecedores_fuzzy) consulta
// `contato_tipos`, então é obrigatório gravar nas duas.
export async function criarFornecedor(payload: FornecedorPayload): Promise<Fornecedor> {
  const { data: contato, error } = await supabase
    .from('contatos')
    .insert({
      tipo: 'fornecedor',
      ativo: payload.ativo ?? true,
      nome: payload.nome,
      nome_empresa: payload.nome_empresa || null,
      cpf_cnpj: payload.cpf_cnpj || null,
      telefone: payload.telefone || null,
      celular: payload.celular || null,
      email: payload.email || null,
      cep: payload.cep || null,
      endereco: payload.endereco || null,
      numero: payload.numero || null,
      complemento: payload.complemento || null,
      bairro: payload.bairro || null,
      cidade: payload.cidade || null,
      estado: payload.estado || null,
      observacoes: payload.observacoes || null,
    })
    .select()
    .single()

  if (error) throw error

  const { error: tipoError } = await supabase
    .from('contato_tipos')
    .insert({ contato_id: contato.id, tipo: 'fornecedor' })

  if (tipoError) throw tipoError

  return contato as Fornecedor
}

export async function atualizarFornecedor(
  id: string,
  payload: FornecedorPayload,
): Promise<Fornecedor> {
  const { data, error } = await supabase
    .from('contatos')
    .update({
      nome: payload.nome,
      nome_empresa: payload.nome_empresa || null,
      cpf_cnpj: payload.cpf_cnpj || null,
      telefone: payload.telefone || null,
      celular: payload.celular || null,
      email: payload.email || null,
      cep: payload.cep || null,
      endereco: payload.endereco || null,
      numero: payload.numero || null,
      complemento: payload.complemento || null,
      bairro: payload.bairro || null,
      cidade: payload.cidade || null,
      estado: payload.estado || null,
      observacoes: payload.observacoes || null,
      ativo: payload.ativo ?? true,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Fornecedor
}

export async function getFornecedorPorCpfCnpj(cpfCnpj: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('contatos')
    .select('id')
    .eq('cpf_cnpj', cpfCnpj)
    .maybeSingle()
  if (error) throw error
  return data
}
