import { readSheet } from 'read-excel-file/browser'
import { supabase } from '@/lib/supabase/client'

// SPEC-247: importa os pedidos da Connect (planilha PedidoCompra_*.xlsx) só com cabeçalho.
// A planilha tem uma linha por parcela; o valor do pedido (vl_nota) e o fornecedor se repetem.

export interface PedidoConnectLinha {
  codigo_pedido: number
  nm_fornecedor: string
  emissao_pedido: string // AAAA-MM-DD
  vl_nota: number
}

export interface PreviaImportacao {
  aplicado: boolean
  inseridos: number
  novos: { codigo: number; fornecedor: string; valor: number; emissao: string; duplicado: boolean }[]
  ja_existem: number[]
  sem_fornecedor: { codigo: number; fornecedor: string; valor: number }[]
}

const COLUNAS = ['codigo_pedido', 'nm_fornecedor', 'emissao_pedido', 'vl_nota'] as const

function paraNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  let s = v.trim().replace(/[R$\s]/g, '')
  if (!s) return null
  // "1.234,56" (BR) ou "1234.56" (US)
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function paraData(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // células de data do Excel chegam à meia-noite UTC: usar os campos UTC evita cair no dia anterior
    return v.toISOString().slice(0, 10)
  }
  if (typeof v !== 'string') return null
  const s = v.trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Lê a planilha no navegador e devolve um pedido por código (a primeira linha de cada um). */
export async function lerPlanilhaPedidosConnect(arquivo: File): Promise<PedidoConnectLinha[]> {
  const linhas = (await readSheet(arquivo)) as unknown as unknown[][]
  if (!linhas?.length) throw new Error('A planilha está vazia.')

  const cabecalho = (linhas[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase())
  const idx = Object.fromEntries(COLUNAS.map((c) => [c, cabecalho.indexOf(c)])) as Record<
    (typeof COLUNAS)[number],
    number
  >
  const faltam = COLUNAS.filter((c) => idx[c] < 0)
  if (faltam.length) {
    throw new Error(
      `Não parece a planilha PedidoCompra da Connect: faltam as colunas ${faltam.join(', ')}.`,
    )
  }

  const porCodigo = new Map<number, PedidoConnectLinha>()
  linhas.slice(1).forEach((l, i) => {
    const codigo = paraNumero(l[idx.codigo_pedido])
    if (codigo == null) {
      if (l.every((c) => c == null || String(c).trim() === '')) return // linha em branco
      throw new Error(`Linha ${i + 2}: código do pedido inválido.`)
    }
    if (porCodigo.has(codigo)) return
    const valor = paraNumero(l[idx.vl_nota])
    const emissao = paraData(l[idx.emissao_pedido])
    const nome = String(l[idx.nm_fornecedor] ?? '').trim()
    if (valor == null || valor < 0) throw new Error(`Pedido ${codigo}: valor da nota inválido.`)
    if (!emissao) throw new Error(`Pedido ${codigo}: data de emissão inválida.`)
    if (!nome) throw new Error(`Pedido ${codigo}: fornecedor em branco.`)
    porCodigo.set(codigo, {
      codigo_pedido: codigo,
      nm_fornecedor: nome,
      emissao_pedido: emissao,
      vl_nota: valor,
    })
  })

  if (porCodigo.size === 0) throw new Error('Nenhum pedido encontrado na planilha.')
  return Array.from(porCodigo.values())
}

// ---- fase 2: PDF do pedido (com as peças)

export interface ResultadoPdf {
  aplicado: boolean
  acao: 'criar' | 'completar' | 'ja_tem_itens' | 'pedido_fechado' | 'sem_fornecedor'
  bloqueado: boolean
  numero: string
  pedido_id: string | null
  fornecedor: string
  itens_pdf: number
  itens_inseridos: number
  soma_itens: number
  total_pdf: number | null
  valor_pedido: number | null
  pecas_nao_cadastradas: { codigo: number; referencia: string | null }[]
  avisos: string[]
}

/** aplicar=false = prévia (nada é gravado); aplicar=true grava os itens (completa ou cria o pedido). */
export async function importarPedidoConnectPdf(
  pedido: import('@/lib/pedido-connect-parser').PedidoPdf,
  aplicar: boolean,
): Promise<ResultadoPdf> {
  const itens = pedido.itens.map((i) => {
    const codigo = Number(i.codigo_produto)
    if (!Number.isInteger(codigo)) throw new Error(`Código de peça inválido no PDF: "${i.codigo_produto}".`)
    return {
      codigo_produto: codigo,
      referencia: i.referencia,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
    }
  })
  const { data, error } = await (supabase as any).rpc('importar_pedido_connect_pdf', {
    p_pedido: {
      numero: pedido.numero,
      fornecedor: pedido.fornecedor,
      empresa: pedido.empresa,
      emissao: pedido.emissao,
      entrega: pedido.entrega,
      pagamento: pedido.pagamento,
      total: pedido.total,
      itens,
    },
    p_aplicar: aplicar,
  })
  if (error) throw error
  return data as ResultadoPdf
}

/** aplicar=false só mostra a prévia (nada é gravado); aplicar=true grava os pedidos novos. */
export async function importarPedidosConnect(
  pedidos: PedidoConnectLinha[],
  aplicar: boolean,
): Promise<PreviaImportacao> {
  const { data, error } = await (supabase as any).rpc('importar_pedidos_connect_cabecalho', {
    p_pedidos: pedidos,
    p_aplicar: aplicar,
  })
  if (error) throw error
  return data as PreviaImportacao
}
