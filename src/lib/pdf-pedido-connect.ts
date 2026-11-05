import { lerPedidoConnect, type PedidoPdf, type TextoPdf } from '@/lib/pedido-connect-parser'

// SPEC-247 fase 2: extrai o texto (com posição) do PDF no navegador e entrega ao parser.
// O PDF não sai do computador do usuário: só os dados lidos vão para o banco.
export async function lerPdfPedidoConnect(arquivo: File): Promise<PedidoPdf> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker

  const data = new Uint8Array(await arquivo.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const paginas: TextoPdf[][] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p)
    const altura = pagina.getViewport({ scale: 1 }).height
    const conteudo = await pagina.getTextContent()
    paginas.push(
      conteudo.items
        .filter((i: any) => typeof i.str === 'string' && i.str.trim() !== '')
        .map((i: any) => ({ str: i.str, x: i.transform[4], y: altura - i.transform[5], w: i.width })),
    )
  }
  return lerPedidoConnect(paginas)
}

export type { PedidoPdf }
