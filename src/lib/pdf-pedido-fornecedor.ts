// SPEC-211: PDF do pedido de compra para enviar ao fornecedor. Mesmo layout do PDF do orçamento
// (Edge Function generate-report, reportType 'orcamento'): logo + dados da empresa à esquerda,
// aceite à direita, bloco do destinatário, tabela de itens, caixa de totais, parcelas e observações.
// Gerado no navegador (pdf-lib, carregada só no clique) para não mexer na Edge Function do orçamento.
import { supabase } from '@/lib/supabase/client'
import logoImg from '@/assets/lucenera-vertical-d5520.png'
import { gerarPdfPedidoFornecedor, type DadosPedidoPdf } from '@/lib/pdf-pedido-fornecedor-desenho'
import { entregaDoContato, getComprasConfig, resolverEntrega } from '@/services/compras-config'


async function carregarDados(pedidoId: string): Promise<DadosPedidoPdf> {
  const { data: pedido, error } = await (supabase as any)
    .from('pedidos_compra')
    .select('*')
    .eq('id', pedidoId)
    .single()
  if (error) throw error

  const [empresa, fornecedor, comprador, itens, parcelas, config] = await Promise.all([
    pedido.empresa_id
      ? (supabase as any)
          .from('empresas')
          .select('nome, razao_social, cnpj, inscricao_estadual, logradouro, numero, complemento, bairro, cidade, estado, cep')
          .eq('id', pedido.empresa_id)
          .maybeSingle()
          .then((r: any) => r.data)
      : Promise.resolve(null),
    (supabase as any)
      .from('contatos')
      .select(
        'nome, razao_social, cpf_cnpj, cnpj, endereco, numero, bairro, cep, cidade, estado, telefone, email, endereco_entrega, numero_entrega, complemento_entrega, bairro_entrega, cidade_entrega, estado_entrega, cep_entrega',
      )
      .eq('id', pedido.fornecedor_id)
      .maybeSingle()
      .then((r: any) => r.data),
    pedido.criado_por
      ? (supabase as any)
          .from('usuarios')
          .select('nome')
          .eq('id', pedido.criado_por)
          .maybeSingle()
          .then((r: any) => r.data?.nome ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    (supabase as any)
      .from('pedido_compra_itens')
      .select(
        'id, produto_id, quantidade, custo_unitario, custo_liquido, valor_ipi, valor_st, valor_outras_despesas, criado_em, produtos(nome, codigo_produto, referencia, unidade)',
      )
      .eq('pedido_id', pedidoId)
      .order('criado_em', { ascending: true })
      .then((r: any) => {
        if (r.error) throw r.error
        return r.data ?? []
      }),
    (supabase as any)
      .from('pedido_compra_parcelas')
      .select('numero_parcela, data_vencimento, valor, status')
      .eq('pedido_id', pedidoId)
      .neq('status', 'cancelado')
      .order('numero_parcela', { ascending: true })
      .then((r: any) => r.data ?? []),
    // SPEC-236: sem a configuração o PDF sai do mesmo jeito, só sem o endereço padrão
    getComprasConfig().catch(() => null),
  ])

  // SPEC-236: endereço próprio do fornecedor (ex.: Manoella/Islight → showroom) ou o padrão do estoque
  const entrega = resolverEntrega(entregaDoContato(fornecedor), config)
  return { pedido, empresa, fornecedor, comprador, itens, parcelas, entrega }
}

// O PNG da logo tem ~17-22% de margem transparente; recorte medido no arquivo de 1920x1512
// (mesmo recorte de src/lib/pdf-logo.ts do sistema de Orçamentos).
const CROP = { x: 329, y: 329, width: 1262, height: 854 }

function logoRecortada(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CROP.width
      canvas.height = CROP.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)
      ctx.drawImage(img, CROP.x, CROP.y, CROP.width, CROP.height, 0, 0, CROP.width, CROP.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = logoImg
  })
}

// SPEC-214: nome padrão do PDF (o mesmo no botão PDF e no anexo do e-mail).
// Ex.: Pedido_Compra_1783_Stella.pdf — sem acento nem espaço, que alguns e-mails estragam.
export function nomeArquivoPedido(numero: string | number, fornecedorNome: string | null | undefined) {
  const limpar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  const forn = limpar(fornecedorNome ?? '').slice(0, 40).replace(/_$/, '')
  return `Pedido_Compra_${limpar(String(numero))}${forn ? `_${forn}` : ''}.pdf`
}

export async function gerarPdfDoPedido(pedidoId: string) {
  const [dados, logo] = await Promise.all([carregarDados(pedidoId), logoRecortada()])
  const bytes = await gerarPdfPedidoFornecedor(dados, logo)
  const nomeArquivo = nomeArquivoPedido(dados.pedido.numero, dados.fornecedor?.nome)
  return { bytes, nomeArquivo }
}

export function baixarArquivo(conteudo: BlobPart, tipo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function baixarPdfPedidoFornecedor(pedidoId: string) {
  const { bytes, nomeArquivo } = await gerarPdfDoPedido(pedidoId)
  baixarArquivo(bytes as BlobPart, 'application/pdf', nomeArquivo)
}
