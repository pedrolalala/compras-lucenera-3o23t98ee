// SPEC-247 (fase 2): lê o PDF "Pedido de compra" da Connect a partir das POSIÇÕES do texto.
// Função pura (sem pdf.js): recebe os pedaços de texto de cada página e devolve o pedido.
// Layout (igual nos PDFs reais de 2026): cabeçalho (empresa, Pedido, Fornecedor, Pagamento, datas) +
// tabela "Item | Produto | Referencia | Descrição | Qtd | UN | Vl. Unit. | Vl. Total" + rodapé a partir de "BC ICMS".
// "Produto" é o código da peça (produtos.codigo_produto). Só a descrição quebra em 2+ linhas.

export interface TextoPdf {
  str: string
  x: number // borda esquerda
  y: number // de cima para baixo
  w: number // largura
}

export interface ItemPedidoPdf {
  item: number
  codigo_produto: string
  referencia: string
  descricao: string
  quantidade: number
  un: string
  valor_unitario: number
  valor_total: number
}

export interface PedidoPdf {
  numero: number | null
  empresa: string
  fornecedor: string
  pagamento: string
  emissao: string | null // AAAA-MM-DD
  entrega: string | null
  referente: string
  total: number | null
  itens: ItemPedidoPdf[]
  avisos: string[]
}

export function numeroBR(s: string): number | null {
  const t = s.replace(/R\$/g, '').replace(/\s/g, '')
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(t)) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function dataBR(s: string | undefined): string | null {
  const m = s?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const dir = (t: TextoPdf) => t.x + t.w
const juntar = (ts: TextoPdf[]) =>
  ts
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t) => t.str.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Primeiro texto logo abaixo de um rótulo (mesma região horizontal). */
function abaixoDe(rotulo: TextoPdf, todos: TextoPdf[], folga = 30, altura = 22): TextoPdf | undefined {
  return todos
    .filter((t) => t.y > rotulo.y + 2 && t.y <= rotulo.y + altura && Math.abs(dir(t) - dir(rotulo)) <= folga + rotulo.w)
    .filter((t) => t.x >= rotulo.x - folga)
    .sort((a, b) => a.y - b.y || a.x - b.x)[0]
}

export function lerPedidoConnect(paginas: TextoPdf[][]): PedidoPdf {
  const r: PedidoPdf = {
    numero: null, empresa: '', fornecedor: '', pagamento: '', emissao: null, entrega: null,
    referente: '', total: null, itens: [], avisos: [],
  }
  const p1 = paginas[0] ?? []
  if (!p1.length) {
    r.avisos.push('O PDF não tem texto legível (pode ser uma imagem/scan).')
    return r
  }

  // ---- cabeçalho (página 1)
  const rot = (txt: string, filtro: (t: TextoPdf) => boolean = () => true) =>
    p1.find((t) => t.str.trim() === txt && filtro(t))
  const lblPedido = rot('Pedido', (t) => t.x > 400)
  if (lblPedido) {
    const n = abaixoDe(lblPedido, p1)
    const num = n && /^\d+$/.test(n.str.trim()) ? Number(n.str.trim()) : null
    r.numero = num
  }
  const topo = p1.filter((t) => t.y < 40 && t.x > 60 && t.x < 400).sort((a, b) => a.y - b.y || a.x - b.x)
  r.empresa = topo[0]?.str.trim() ?? ''

  const lblForn = rot('Fornecedor')
  const lblPag = rot('Pagamento')
  if (lblForn) {
    const ate = lblPag?.y ?? lblForn.y + 40
    r.fornecedor = juntar(p1.filter((t) => t.x < 300 && t.y > lblForn.y + 2 && t.y < ate - 2))
  }
  if (lblPag) {
    const v = abaixoDe(lblPag, p1, 60, 18)
    r.pagamento = v?.str.trim() ?? ''
  }
  const lblEmi = rot('Data Emissao')
  const lblEnt = rot('Data Entrega')
  r.emissao = lblEmi ? dataBR(abaixoDe(lblEmi, p1)?.str) : null
  r.entrega = lblEnt ? dataBR(abaixoDe(lblEnt, p1)?.str) : null

  // ---- colunas pela linha de títulos da tabela
  const tit = (txt: string) => p1.find((t) => t.str.trim() === txt && t.x < 700)
  const hItem = tit('Item'), hProd = tit('Produto'), hRef = tit('Referencia'), hDesc = tit('Descrição')
  const hQtd = tit('Qtd'), hUn = tit('UN'), hUnit = tit('Vl. Unit.')
  if (!hItem || !hProd || !hRef || !hDesc || !hQtd || !hUn || !hUnit) {
    r.avisos.push('Não achei os títulos da tabela de itens (Item, Produto, Referencia, Descrição, Qtd, UN, Vl. Unit.). Este PDF não parece ser um pedido da Connect.')
    return r
  }
  const cab = hItem.y
  const lblRef = p1.filter((t) => t.x < 450 && t.y > (lblPag?.y ?? 0) + 14 && t.y < cab - 2 && !/^(Data|Pagamento|Fornecedor)/.test(t.str.trim()))
  r.referente = juntar(lblRef.filter((t) => t.x < 300))

  const xProd = hProd.x - 3, xRef = hRef.x - 3, xDesc = hDesc.x - 3
  const xQtd = hQtd.x - 25, xUn = hUn.x - 5, xUnit = hUnit.x - 20
  const dirUnit = dir(hUnit) + 4

  type Col = 'item' | 'produto' | 'ref' | 'desc' | 'qtd' | 'un' | 'unit' | 'total'
  const coluna = (t: TextoPdf): Col => {
    if (t.x < xProd) return 'item'
    if (t.x < xRef) return 'produto'
    if (t.x < xDesc) return 'ref'
    if (t.x < xQtd) return 'desc'
    if (t.x < xUn) return 'qtd'
    if (t.x < xUnit) return 'un'
    return dir(t) <= dirUnit ? 'unit' : 'total'
  }

  // ---- itens (todas as páginas)
  let achou = false
  for (let pi = 0; pi < paginas.length; pi++) {
    const pg = paginas[pi]
    const temCab = pi === 0
    const rodape = pg.find((t) => t.str.trim() === 'BC ICMS')
    const ini = temCab ? cab : -1
    const fim = rodape?.y ?? Infinity
    const ancoras = pg
      .filter((t) => t.y > ini + 2 && t.y < fim - 2 && t.x < xProd && /^\d+$/.test(t.str.trim()))
      .sort((a, b) => a.y - b.y)
    if (!ancoras.length) continue
    achou = true
    const linhas = ancoras.map((a, i) => ({
      a, y0: a.y - 2, y1: i + 1 < ancoras.length ? ancoras[i + 1].y - 2 : fim, toks: [] as TextoPdf[],
    }))
    for (const t of pg) {
      if (t.y <= ini + 2 || t.y >= fim - 2) continue
      const l = linhas.find((l) => t.y >= l.y0 && t.y < l.y1)
      if (l) l.toks.push(t)
    }
    for (const l of linhas) {
      const por = (c: Col) => l.toks.filter((t) => coluna(t) === c)
      const qtd = numeroBR(juntar(por('qtd')))
      const unit = numeroBR(juntar(por('unit')))
      const tot = numeroBR(juntar(por('total')))
      const cod = juntar(por('produto'))
      const n = Number(l.a.str.trim())
      if (!cod || qtd == null || unit == null || tot == null) {
        r.avisos.push(`Item ${n}: não consegui ler código, quantidade ou valores (confira o PDF).`)
        continue
      }
      r.itens.push({
        item: n, codigo_produto: cod, referencia: juntar(por('ref')), descricao: juntar(por('desc')),
        quantidade: qtd, un: juntar(por('un')), valor_unitario: unit, valor_total: tot,
      })
    }
    // total da nota (rodapé da última página que o tiver)
    const lblTot = pg.find((t) => t.str.trim() === 'VL Total Nota')
    if (lblTot) {
      const v = abaixoDe(lblTot, pg, 30, 20)
      const n = v ? numeroBR(v.str) : null
      if (n != null) r.total = n
    }
  }
  if (!achou) r.avisos.push('Não encontrei nenhum item na tabela do PDF.')

  // ---- conferências
  if (r.numero == null) r.avisos.push('Não achei o número do pedido no PDF.')
  if (!r.fornecedor) r.avisos.push('Não achei o fornecedor no PDF.')
  const soma = Math.round(r.itens.reduce((s, i) => s + i.valor_total, 0) * 100) / 100
  if (r.total != null && Math.abs(soma - r.total) > 0.05) {
    r.avisos.push(`A soma dos itens (${soma.toFixed(2)}) não bate com o Total da Nota (${r.total.toFixed(2)}).`)
  }
  for (const i of r.itens) {
    const conta = Math.round(i.quantidade * i.valor_unitario * 100) / 100
    if (Math.abs(conta - i.valor_total) > 0.05) {
      r.avisos.push(`Item ${i.item}: quantidade × valor unitário (${conta.toFixed(2)}) difere do total da linha (${i.valor_total.toFixed(2)}).`)
    }
  }
  return r
}
