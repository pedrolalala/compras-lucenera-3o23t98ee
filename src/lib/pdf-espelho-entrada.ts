// SPEC-220 (reunião Vinicius 21/10): espelho da entrada da nota, para o Mateus organizar a parte física —
// o que chegou, para quem foi vinculado (venda / cliente / L) e o que ficou livre no estoque. Hoje cada um salva o
// espelho da Connect com um nome; aqui o nome é padrão: Entrada_NF_<número>_<Fornecedor>.pdf.
import type { PDFDocument as TPDFDocument, PDFPage } from 'pdf-lib'
import type { EspelhoEntrada } from '@/services/notas-fiscais-compra'

const brl = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
function dia(v: string | null | undefined) {
  if (!v) return '-'
  const [a, m, d] = String(v).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function nomeArquivoEspelho(e: EspelhoEntrada) {
  const limpar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  const forn = limpar(e.nota.fornecedor_nome ?? '').slice(0, 40).replace(/_$/, '')
  return `Entrada_NF_${limpar(e.nota.numero_nf)}${forn ? `_${forn}` : ''}.pdf`
}

export async function gerarPdfEspelhoEntrada(e: EspelhoEntrada): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf: TPDFDocument = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const cinza = rgb(0.45, 0.45, 0.45)
  const limpo = (t: unknown) =>
    Array.from(String(t ?? ''))
      .map((ch) => {
        try {
          font.encodeText(ch)
          return ch
        } catch {
          return '?'
        }
      })
      .join('')
  const caber = (t: unknown, f: typeof font, size: number, max: number) => {
    let s = limpo(t)
    if (f.widthOfTextAtSize(s, size) <= max) return s
    while (s.length > 1 && f.widthOfTextAtSize(`${s}...`, size) > max) s = s.slice(0, -1)
    return `${s}...`
  }

  const W = 595.28
  const H = 841.89
  const M = 40
  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M
  const novaPaginaSePreciso = (altura: number) => {
    if (y - altura < M + 20) {
      page = pdf.addPage([W, H])
      y = H - M
    }
  }
  const texto = (t: unknown, x: number, size = 9, f = font, cor = rgb(0, 0, 0), max = W - M - x) =>
    page.drawText(caber(t, f, size, max), { x, y, size, font: f, color: cor })
  const direita = (t: string, xFim: number, size = 9, f = font) =>
    page.drawText(limpo(t), { x: xFim - f.widthOfTextAtSize(limpo(t), size), y, size, font: f })
  const linha = () => {
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.5, color: cinza })
  }

  const n = e.nota
  texto(`Espelho da entrada — NF ${n.numero_nf}`, M, 15, bold)
  if (n.cancelada_em) texto('CANCELADA', W - M - 80, 12, bold, rgb(0.8, 0.1, 0.1))
  y -= 20
  const doc = (n.fornecedor_documento ?? '').replace(/\D/g, '')
  const docFmt =
    doc.length === 14
      ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : doc.length === 11
        ? doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
        : doc
  texto(`${n.fornecedor_nome ?? '-'}${docFmt ? `  ·  CNPJ ${docFmt}` : ''}`, M, 10, bold)
  y -= 14
  texto(
    `Pedido ${n.pedido_numero ?? '-'}  ·  ${n.empresa_nome ?? '-'}  ·  Emissão ${dia(n.data_emissao)}  ·  Entrega ${dia(n.data_entrega)}  ·  Entrada ${dia(n.data_entrada)}`,
    M,
    9,
  )
  y -= 12
  if (n.chave_acesso) {
    texto(`Chave de acesso: ${n.chave_acesso}`, M, 8, font, cinza)
    y -= 11
  }
  texto(`Lançado por ${n.lancado_por ?? '-'}${n.apropriacao ? `  ·  Apropriação: ${n.apropriacao}` : ''}`, M, 8, font, cinza)
  y -= 20

  // Itens e para quem foi
  texto('O que chegou e para quem foi', M, 11, bold)
  y -= 16
  texto('Código', M, 8, bold)
  texto('Produto', M + 55, 8, bold)
  direita('Qtd.', M + 400, 8, bold)
  direita('Vl. unit.', W - M, 8, bold)
  y -= 5
  linha()
  y -= 10
  for (const it of e.itens) {
    novaPaginaSePreciso(30)
    texto(it.codigo ?? '-', M, 9, bold)
    texto(it.produto, M + 55, 9, bold, rgb(0, 0, 0), 300)
    direita(qtd(Number(it.quantidade)), M + 400, 9, bold)
    direita(it.valor_unitario != null ? brl(it.valor_unitario) : '-', W - M)
    y -= 12
    const vinc = e.vinculos.filter((v) => v.produto_id === it.produto_id)
    let vinculado = 0
    for (const v of vinc) {
      novaPaginaSePreciso(14)
      vinculado += Number(v.quantidade)
      texto(
        `-> ${v.venda_numero ?? v.orcamento_numero ?? '-'}  ·  ${v.cliente_nome ?? '-'}  ·  ${v.l_fixo ?? '-'}${v.projeto_codigo ? `  ·  projeto ${v.projeto_codigo}` : ''}`,
        M + 65,
        8.5,
        font,
        rgb(0, 0, 0),
        320,
      )
      direita(qtd(Number(v.quantidade)), M + 400, 8.5)
      y -= 11
    }
    const livre = Number(it.quantidade) - vinculado
    if (livre > 0.0001) {
      novaPaginaSePreciso(14)
      texto('-> Livre no estoque (sem cliente)', M + 65, 8.5, font, cinza)
      direita(qtd(livre), M + 400, 8.5)
      y -= 11
    }
    y -= 4
  }
  linha()
  y -= 16

  // Financeiro
  novaPaginaSePreciso(80)
  texto('Financeiro', M, 11, bold)
  y -= 15
  const totais: [string, number | null][] = [
    ['Valor da nota', n.valor],
    ['ST', n.valor_st],
    ['Desconto', n.valor_desconto],
    ['Despesas acessórias', n.valor_despesas_acessorias],
    ['Pagamento antecipado usado', e.antecipacao],
  ]
  for (const [rot, v] of totais) {
    if (!v) continue
    texto(rot, M, 9)
    direita(brl(v), M + 250, 9)
    y -= 12
  }
  if (e.parcelas.length > 0) {
    y -= 4
    texto('Parcelas', M, 9, bold)
    y -= 12
    for (const p of e.parcelas) {
      novaPaginaSePreciso(14)
      texto(`${p.numero}ª  ·  vence ${dia(p.vencimento)}`, M, 9)
      direita(brl(p.valor), M + 250, 9)
      y -= 12
    }
  }
  if (n.observacao) {
    y -= 8
    novaPaginaSePreciso(20)
    texto(`Observação: ${n.observacao}`, M, 8.5, font, cinza)
  }

  const paginas = pdf.getPages()
  paginas.forEach((p, i) =>
    p.drawText(limpo(`NF ${n.numero_nf}  ·  ${i + 1} de ${paginas.length}`), { x: M, y: 20, size: 7, font, color: cinza }),
  )
  return pdf.save()
}
