// SPEC-211: desenho do PDF do pedido de compra para o fornecedor (sem nada do navegador, para
// poder ser testado fora dele). Os dados vêm de pdf-pedido-fornecedor.ts.
import type { PDFDocument as TPDFDocument } from 'pdf-lib'

export interface DadosPedidoPdf {
  pedido: any
  empresa: any
  fornecedor: any
  comprador: string | null
  itens: any[]
  parcelas: { numero_parcela: number; data_vencimento: string | null; valor: number }[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qtdFmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
function dia(v: string | null | undefined) {
  if (!v) return '-'
  const [a, m, d] = String(v).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** logoPngBase64: PNG já recortado, como data URL (ou null). */
export async function gerarPdfPedidoFornecedor(
  dados: DadosPedidoPdf,
  logo: string | null,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const { pedido, empresa, fornecedor, comprador, itens, parcelas } = dados
  const pdf: TPDFDocument = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const cinza = rgb(0.4, 0.4, 0.4)

  // Helvetica padrão só tem o conjunto WinAnsi (acentos do português ok); troca o resto por '?'.
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
  // corta o texto para caber na largura (com "...")
  const caber = (t: unknown, f: typeof font, size: number, max: number) => {
    let s = limpo(t)
    if (f.widthOfTextAtSize(s, size) <= max) return s
    while (s.length > 1 && f.widthOfTextAtSize(`${s}...`, size) > max) s = s.slice(0, -1)
    return `${s}...`
  }
  // quebra em linhas pela largura
  const quebrar = (t: unknown, size: number, max: number) => {
    const linhas: string[] = []
    for (const par of String(t ?? '').split(/\r?\n/).map(limpo)) {
      let atual = ''
      for (const palavra of par.split(/\s+/)) {
        const tenta = atual ? `${atual} ${palavra}` : palavra
        if (font.widthOfTextAtSize(tenta, size) > max && atual) {
          linhas.push(atual)
          atual = palavra
        } else atual = tenta
      }
      linhas.push(atual)
    }
    return linhas
  }

  let page = pdf.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  const novaPagina = () => {
    page = pdf.addPage([595.28, 841.89])
    return height - 50
  }

  // ---------- Cabeçalho: logo + empresa que compra ----------
  let textY = height - 15
  if (logo) {
    try {
      const bytes = Uint8Array.from(atob(logo.split(',')[1]), (c) => c.charCodeAt(0))
      const img = await pdf.embedPng(bytes)
      const escala = Math.min(110 / img.width, 50 / img.height)
      const w = img.width * escala
      const h = img.height * escala
      page.drawImage(img, { x: 40, y: height - 15 - h, width: w, height: h })
      textY = height - 15 - h - 14
    } catch {
      /* sem logo */
    }
  }
  const emp = empresa || {}
  const linhasEmpresa = [
    emp.razao_social || emp.nome || 'Lucenera',
    emp.cnpj ? `CNPJ: ${emp.cnpj}${emp.inscricao_estadual ? `  IE: ${emp.inscricao_estadual}` : ''}` : null,
    [emp.logradouro, emp.numero, emp.complemento].filter(Boolean).join(', ') || null,
    [emp.bairro, emp.cidade && `${emp.cidade}/${emp.estado || ''}`, emp.cep && `CEP ${emp.cep}`]
      .filter(Boolean)
      .join(' - ') || null,
    '(16) 3442 - 3545',
  ].filter(Boolean) as string[]
  page.drawText(caber(emp.nome || 'Lucenera', bold, 10, 300), { x: 40, y: textY, size: 10, font: bold })
  linhasEmpresa.forEach((l, i) =>
    page.drawText(caber(l, font, 8, 300), { x: 40, y: textY - 10 * (i + 1), size: 8, font }),
  )
  const fimEmpresaY = textY - 10 * linhasEmpresa.length

  // ---------- Direita: aceite do fornecedor ----------
  const topo = height - 15
  const aceiteY = topo - 25
  page.drawLine({ start: { x: width - 200, y: aceiteY }, end: { x: width - 40, y: aceiteY }, thickness: 1 })
  page.drawText('Aceite do Fornecedor', { x: width - 195, y: aceiteY + 3, size: 8, font })
  const assinaturaY = aceiteY - 25
  page.drawLine({ start: { x: width - 200, y: assinaturaY }, end: { x: width - 40, y: assinaturaY }, thickness: 1 })
  page.drawText(caber(emp.nome || 'Lucenera', font, 8, 150), { x: width - 195, y: assinaturaY + 3, size: 8, font })
  const impressaoY = assinaturaY - 10
  page.drawText(
    `Data Impressão ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    { x: width - 150, y: impressaoY, size: 6, font, color: cinza },
  )
  page.drawText(`Data Emissão ${dia(pedido.data_emissao || pedido.criado_em)}`, {
    x: width - 150,
    y: impressaoY - 9,
    size: 6,
    font,
    color: cinza,
  })

  let y = Math.min(fimEmpresaY, impressaoY - 9) - 15
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 2 })

  // ---------- Fornecedor (destinatário) + número do pedido ----------
  y -= 25
  page.drawText('Pedido de compra para', { x: 40, y, size: 11, font })
  page.drawText('Pedido de Compra', { x: width - 140, y, size: 11, font })
  page.drawText(limpo(pedido.numero), { x: width - 140, y: y - 18, size: 13, font: bold })
  const forn = fornecedor || {}
  page.drawText(caber(String(forn.nome || 'FORNECEDOR').toUpperCase(), bold, 13, 360), {
    x: 40,
    y: y - 18,
    size: 13,
    font: bold,
  })
  let fy = y - 33
  const linhaForn = (t: string | null) => {
    if (!t) return
    page.drawText(caber(t, font, 9, 360), { x: 40, y: fy, size: 9, font })
    fy -= 12
  }
  if (forn.razao_social && forn.razao_social !== forn.nome) linhaForn(forn.razao_social)
  const doc = forn.cnpj || forn.cpf_cnpj
  if (doc) linhaForn(`CNPJ/CPF: ${doc}`)
  linhaForn([forn.endereco, forn.numero, forn.bairro].filter(Boolean).join(', ') || null)
  linhaForn(
    [forn.cep && `CEP: ${forn.cep}`, forn.cidade && `${forn.cidade}${forn.estado ? `/${forn.estado}` : ''}`]
      .filter(Boolean)
      .join(' - ') || null,
  )
  linhaForn(`TEL: ${forn.telefone || '-'}${forn.email ? `   E-MAIL: ${forn.email}` : ''}`)

  // ---------- Comprador / previsão / local de entrega ----------
  y = fy - 15
  page.drawText('Comprador', { x: 40, y, size: 9, font })
  page.drawText(caber(comprador || 'Compras', bold, 9, 160), { x: 40, y: y - 12, size: 9, font: bold })
  page.drawText('Previsão de entrega', { x: 220, y, size: 9, font })
  page.drawText(dia(pedido.data_prevista_entrega), { x: 220, y: y - 12, size: 9, font: bold })
  page.drawText('Local de entrega', { x: 340, y, size: 9, font })
  page.drawText(caber(pedido.local_entrega || '-', bold, 9, width - 40 - 340), {
    x: 340,
    y: y - 12,
    size: 9,
    font: bold,
  })
  y -= 30

  // ---------- Itens ----------
  // x de cada coluna; números alinhados à direita no fim da coluna
  const col = { cod: 40, ref: 85, desc: 175, un: 375, qtd: 430, unit: 495, sub: width - 40 }
  const cabecalho = () => {
    page.drawText('Código', { x: col.cod, y, size: 9, font: bold })
    page.drawText('Referência', { x: col.ref, y, size: 9, font: bold })
    page.drawText('Descrição', { x: col.desc, y, size: 9, font: bold })
    page.drawText('Un.', { x: col.un, y, size: 9, font: bold })
    const dir = (t: string, x: number) =>
      page.drawText(t, { x: x - bold.widthOfTextAtSize(t, 9), y, size: 9, font: bold })
    dir('Qtd.', col.qtd)
    dir('Vl. Unit.', col.unit)
    dir('Subtotal', col.sub)
    y -= 10
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1 })
    y -= 15
  }
  cabecalho()

  let totalProdutos = 0
  let totalIpi = 0
  let totalSt = 0
  let totalOutras = 0
  let totalBruto = 0
  // SPEC-213: a mesma peça (vários L) sai numa linha só, com a quantidade e o subtotal somados.
  const porPeca = new Map<string, { p: any; q: number; sub: number }>()
  for (const i of itens) {
    const q = Number(i.quantidade) || 0
    const unit = Number(i.custo_unitario) || 0
    // preço de custo sem impostos; pedidos antigos sem custo_liquido usam o custo unitário
    const liq = i.custo_liquido != null ? Number(i.custo_liquido) : unit
    totalProdutos += q * liq
    totalIpi += q * (Number(i.valor_ipi) || 0)
    totalSt += q * (Number(i.valor_st) || 0)
    totalOutras += q * (Number(i.valor_outras_despesas) || 0)
    totalBruto += q * unit

    const p = i.produtos || {}
    const chave = String(i.produto_id ?? `${p.codigo_produto}|${p.referencia}|${p.nome}`)
    const g = porPeca.get(chave) ?? { p, q: 0, sub: 0 }
    g.q += q
    g.sub += q * liq
    porPeca.set(chave, g)
  }

  for (const { p, q, sub } of porPeca.values()) {
    if (y < 60) {
      y = novaPagina()
      cabecalho()
    }
    page.drawText(caber(p.codigo_produto ?? '-', bold, 8, col.ref - col.cod - 4), { x: col.cod, y, size: 8, font: bold })
    page.drawText(caber(p.referencia || '-', font, 8, col.desc - col.ref - 4), { x: col.ref, y, size: 8, font })
    page.drawText(caber(p.nome || '-', font, 8, col.un - col.desc - 6), { x: col.desc, y, size: 8, font })
    page.drawText(caber(p.unidade || 'UN', font, 8, 30), { x: col.un, y, size: 8, font })
    const dir = (t: string, x: number) =>
      page.drawText(t, { x: x - font.widthOfTextAtSize(t, 8), y, size: 8, font })
    dir(qtdFmt(q), col.qtd)
    dir(brl(q > 0 ? sub / q : 0), col.unit)
    dir(brl(sub), col.sub)
    y -= 15
  }
  y -= 5

  // ---------- Totais ----------
  const descPerc = Number(pedido.desconto_percentual) || 0
  const descValor = descPerc > 0 ? totalBruto * (descPerc / 100) : 0
  const total = pedido.valor_total != null ? Number(pedido.valor_total) : totalBruto - descValor
  const linhasTotal: [string, number][] = [['Total dos produtos:', totalProdutos]]
  if (totalIpi > 0) linhasTotal.push(['IPI:', totalIpi])
  if (totalSt > 0) linhasTotal.push(['ST:', totalSt])
  if (totalOutras > 0) linhasTotal.push(['Outras despesas:', totalOutras])
  if (descValor > 0) linhasTotal.push([`Desconto (${qtdFmt(descPerc)}%):`, -descValor])

  const alturaCaixa = 15 * linhasTotal.length + 33
  if (y - alturaCaixa < 120) y = novaPagina()
  page.drawRectangle({
    x: width - 270,
    y: y - alturaCaixa + 10,
    width: 230,
    height: alturaCaixa,
    color: rgb(0.95, 0.95, 0.95),
  })
  const direita = width - 56
  let ty = y - 15
  for (const [rotulo, v] of linhasTotal) {
    const t = v < 0 ? `- ${brl(-v)}` : brl(v)
    page.drawText(rotulo, { x: width - 250, y: ty, size: 10, font })
    page.drawText(t, { x: direita - font.widthOfTextAtSize(t, 10), y: ty, size: 10, font })
    ty -= 15
  }
  ty -= 3
  const tTotal = brl(total)
  page.drawText('Valor Total:', { x: width - 250, y: ty, size: 12, font: bold })
  page.drawText(tTotal, { x: direita - bold.widthOfTextAtSize(tTotal, 12), y: ty, size: 12, font: bold })

  // ---------- Condições de pagamento ----------
  y -= alturaCaixa + 10
  page.drawText('Condições de Pagamento:', { x: width - 250, y, size: 8, font })
  y -= 14
  if (parcelas.length > 0) {
    for (const p of parcelas) {
      if (y < 60) y = novaPagina()
      page.drawText(`Parcela ${p.numero_parcela}: ${dia(p.data_vencimento)} — ${brl(Number(p.valor) || 0)}`, {
        x: width - 250,
        y,
        size: 9,
        font: bold,
      })
      y -= 13
    }
  } else {
    page.drawText(caber(pedido.condicoes_pagamento || 'A combinar', bold, 9, 210), {
      x: width - 250,
      y,
      size: 9,
      font: bold,
    })
    y -= 13
  }

  // ---------- Observações ----------
  y -= 15
  if (y < 80) y = novaPagina()
  page.drawText('OBSERVAÇÕES:', { x: 40, y, size: 9, font: bold })
  y -= 15
  const obs = [
    ...(pedido.observacao ? quebrar(pedido.observacao, 8, width - 80) : []),
    `Favor mencionar o número do pedido (${limpo(pedido.numero)}) na nota fiscal.`,
    'Confirmar quantidades, preços e prazo de entrega antes do faturamento.',
  ]
  for (const l of obs) {
    if (y < 40) y = novaPagina()
    page.drawText(l, { x: 40, y, size: 8, font })
    y -= 12
  }

  // numeração "1 de N" no canto de cada página
  const paginas = pdf.getPages()
  paginas.forEach((pg, i) => {
    const t = `${i + 1} de ${paginas.length}`
    pg.drawText(t, { x: width - 40 - bold.widthOfTextAtSize(t, 9), y: height - 15, size: 9, font: bold })
  })

  return await pdf.save()
}
