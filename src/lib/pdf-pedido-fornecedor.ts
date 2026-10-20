// SPEC-211: PDF do pedido de compra para enviar ao fornecedor. Mesmo layout do PDF do orçamento
// (Edge Function generate-report, reportType 'orcamento'): logo + dados da empresa à esquerda,
// aceite à direita, bloco do destinatário, tabela de itens, caixa de totais, parcelas e observações.
// Gerado no navegador (pdf-lib, carregada só no clique) para não mexer na Edge Function do orçamento.
import { supabase } from '@/lib/supabase/client'
import logoImg from '@/assets/lucenera-vertical-d5520.png'
import { gerarPdfPedidoFornecedor, type DadosPedidoPdf } from '@/lib/pdf-pedido-fornecedor-desenho'


async function carregarDados(pedidoId: string): Promise<DadosPedidoPdf> {
  const { data: pedido, error } = await (supabase as any)
    .from('pedidos_compra')
    .select('*')
    .eq('id', pedidoId)
    .single()
  if (error) throw error

  const [empresa, fornecedor, comprador, itens, parcelas] = await Promise.all([
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
      .select('nome, razao_social, cpf_cnpj, cnpj, endereco, numero, bairro, cep, cidade, estado, telefone, email')
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
        'id, quantidade, custo_unitario, custo_liquido, valor_ipi, valor_st, valor_outras_despesas, criado_em, produtos(nome, codigo_produto, referencia, unidade)',
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
  ])

  return { pedido, empresa, fornecedor, comprador, itens, parcelas }
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

export async function baixarPdfPedidoFornecedor(pedidoId: string) {
  const [dados, logo] = await Promise.all([carregarDados(pedidoId), logoRecortada()])
  const bytes = await gerarPdfPedidoFornecedor(dados, logo)
  const pedido = dados.pedido
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Pedido_Compra_${String(pedido.numero).replace(/[^\w-]+/g, '_')}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
