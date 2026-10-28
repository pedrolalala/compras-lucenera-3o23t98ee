// SPEC-214: "Enviar ao fornecedor". O navegador não consegue abrir o Outlook com anexo (mailto não
// aceita anexo), então baixamos um rascunho .eml com o cabeçalho X-Unsent: 1: o Outlook clássico abre
// esse arquivo como e-mail novo, pronto para enviar, com Para, Assunto, texto e o PDF já anexado.
import { baixarArquivo, gerarPdfDoPedido } from '@/lib/pdf-pedido-fornecedor'

export function assuntoPadrao(numero: string, empresaNome: string | null) {
  return `Pedido de Compra nº ${numero}${empresaNome ? ` - ${empresaNome}` : ''}`
}

export function textoPadrao(
  numero: string,
  empresaNome: string | null,
  remetente: string | null,
  // SPEC-236: WhatsApp do Compras vem de compras_config
  whatsappCompras?: string | null,
) {
  return [
    'Prezados,',
    '',
    `Segue em anexo o Pedido de Compra nº ${numero}${empresaNome ? ` da ${empresaNome}` : ''}.`,
    '',
    'Por favor, confirmem o recebimento deste pedido e o prazo de entrega.',
    'Pedimos que o número do pedido seja mencionado na nota fiscal.',
    ...(whatsappCompras
      ? ['', `Qualquer dúvida, fale com o setor de Compras pelo WhatsApp: ${whatsappCompras}`]
      : []),
    '',
    'Atenciosamente,',
    ...(remetente ? [remetente] : []),
    ...(empresaNome ? [empresaNome] : []),
  ].join('\n')
}

/** Separa "a@x.com; b@y.com" em endereços. */
export function separarEmails(texto: string): string[] {
  return texto
    .split(/[;,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean)
}

export function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function base64DeBytes(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

// Base64 em linhas de 76 caracteres (limite do formato de e-mail).
function emLinhas(b64: string) {
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? ''
}

function cabecalhoUtf8(texto: string) {
  return `=?UTF-8?B?${base64DeBytes(new TextEncoder().encode(texto))}?=`
}

export function montarEml(opts: {
  para: string[]
  copia?: string[]
  assunto: string
  texto: string
  anexoNome: string
  anexoBytes: Uint8Array
}) {
  const limite = `----=_Lucenera_${Date.now().toString(36)}`
  const linhas = [
    'X-Unsent: 1',
    `To: ${opts.para.join(', ')}`,
    ...(opts.copia?.length ? [`Cc: ${opts.copia.join(', ')}`] : []),
    `Subject: ${cabecalhoUtf8(opts.assunto)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    emLinhas(base64DeBytes(new TextEncoder().encode(opts.texto.replace(/\r?\n/g, '\r\n')))),
    '',
    `--${limite}`,
    `Content-Type: application/pdf; name="${opts.anexoNome}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${opts.anexoNome}"`,
    '',
    emLinhas(base64DeBytes(opts.anexoBytes)),
    '',
    `--${limite}--`,
    '',
  ]
  return linhas.join('\r\n')
}

export async function baixarEmailPedido(
  pedidoId: string,
  opts: { para: string[]; copia?: string[]; assunto: string; texto: string },
) {
  const { bytes, nomeArquivo } = await gerarPdfDoPedido(pedidoId)
  const eml = montarEml({ ...opts, anexoNome: nomeArquivo, anexoBytes: bytes })
  baixarArquivo(eml, 'message/rfc822', nomeArquivo.replace(/\.pdf$/, '.eml'))
}
