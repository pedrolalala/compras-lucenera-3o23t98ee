import { useState, useEffect, useMemo } from 'react'
import { semPrefixo } from '@/lib/numeros'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, PackageCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  criarPedidoCompraLote,
  gerarParcelasPedidoCompra,
  getEmpresas,
  getPrazoMedioFornecedor,
  getProdutoImpostosBulk,
  upsertObservacaoProdutoFornecedor,
  getItensPorCaixa,
  podeEditarCaixaFechada,
  salvarItensPorCaixa,
  arredondarParaCaixa,
  fechaCaixa,
  vincularOrigemPedidoItem,
  type Empresa,
} from '@/services/pedido-compra'
import type { LinhaCarrinho } from '@/services/necessidade-compra-item'
import {
  CampoPercentual,
  TotaisCompra,
  brl,
  calcularCustoItem,
  percentualParaCampo,
} from '@/components/compra/custo-compra'
import { ObservacaoCaixaFechada } from '@/components/compra/ObservacaoCaixaFechada'
import { CondicaoPagamentoCampo } from '@/components/compra/CondicaoPagamentoCampo'
import { useArrastavel } from '@/components/compra/use-arrastavel'

// SPEC-155 (P3): remove as setinhas de incremento nativas dos campos
// numéricos deste modal -- pedido explícito do relatório (atrapalhavam
// digitação de valor com várias casas decimais). Tailwind não tem
// utilitário pronto pra isso; arbitrary variants cobrem WebKit e Firefox.
const NO_SPINNER =
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

// SPEC-209 A: "Fechar pedido" do carrinho da Necessidade de Compra (e do Pedido avulso, SPEC-222 F1).
// SPEC-222 F4: uma linha por PEÇA com a soma dos L escolhidos (a escolha de L e quantidade por L fica na
// Necessidade) — com 10–15 dias sem comprar de um fornecedor, a lista por L ficava gigante para conferir.
//   - o pedido grava um item por peça; o vínculo de origem (P-03) liga esse item a cada L, repartindo a
//     quantidade na ordem do carrinho (mapeado por ÍNDICE: criar_pedido_compra_lote preserva a ordem);
//   - pode comprar a mais (caixa fechada, desconto do fornecedor): o que passa da soma dos L fica sem vínculo;
//     comprar a menos atende os primeiros L e o resto continua na necessidade.
// SPEC-240: peça com "Itens por caixa" já abre arredondada para cima até fechar a caixa (38, caixa 10 → 40);
//   o que passa das vendas segue o caminho acima (fica para estoque). Digitar fora da caixa só avisa.

// SPEC-240 C: com desconto de caixa fechada, o preço de custo vem com o desconto enquanto a quantidade fecha
// caixa e volta ao preço cheio quando não fecha. Preço digitado à mão não é mexido.
function aplicarDescontoCaixa<
  T extends { custoBase: string; custoLiquido: string; custoManual: boolean; descontoCaixa: number; itensPorCaixa: number; quantidade: string },
>(l: T): T {
  if (l.custoManual || !(l.descontoCaixa > 0)) return l
  const base = parseFloat(l.custoBase)
  if (!(base > 0)) return l
  const custo = fechaCaixa(parseFloat(l.quantidade) || 0, l.itensPorCaixa)
    ? Math.round(base * (1 - l.descontoCaixa / 100) * 10000) / 10000
    : base
  return { ...l, custoLiquido: String(custo) }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  itens: LinhaCarrinho[]
  fornecedorId: string
  fornecedorNome: string
  onSuccess: () => void
}

interface LinhaItem {
  chave: string
  produto_id: string
  produto: string
  produto_codigo: string | null
  /** L do carrinho desta peça (vazio = pedido avulso, sem venda). */
  origens: LinhaCarrinho[]
  qtdVendas: number
  quantidade: string
  // SPEC-209 B: preço de custo (já com desconto) + ST/IPI/outras despesas em % (sem ICMS)
  custoLiquido: string
  /** SPEC-240 C: preço de custo sem o desconto da caixa fechada; custoManual = digitado à mão. */
  custoBase: string
  custoManual: boolean
  descontoCaixa: number
  stPerc: string
  ipiPerc: string
  outrasPerc: string
  observacaoFornecedor: string | null
  /** SPEC-240: produtos.multiplo_compra (1 = sem regra). */
  itensPorCaixa: number
  // SPEC-212: "Tirar" — peça selecionada a mais não entra no pedido (igual ao Editar pedido)
  remover: boolean
}

export function ModalGerarCompraItemOrcamento({
  open,
  onOpenChange,
  itens,
  fornecedorId,
  fornecedorNome,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const arrastar = useArrastavel(open)

  const [linhas, setLinhas] = useState<LinhaItem[]>([])
  const [numero, setNumero] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [condicoesPagamento, setCondicoesPagamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [perfil, setPerfil] = useState('')
  const [descontoPercentual, setDescontoPercentual] = useState('')
  const [localEntrega, setLocalEntrega] = useState('')
  const [prazoMedio, setPrazoMedio] = useState<{ dias: number; pedidos: number } | null>(null)
  const [salvandoObs, setSalvandoObs] = useState<string | null>(null)
  const [podeEditarCaixa, setPodeEditarCaixa] = useState(false)

  // SPEC-209 A4: já vem com a empresa da venda quando todas as linhas são da mesma empresa.
  const empresaDasVendas = useMemo(() => {
    const ids = new Set(itens.map((i) => i.empresa_id).filter(Boolean))
    return ids.size === 1 ? (Array.from(ids)[0] as string) : ''
  }, [itens])

  useEffect(() => {
    if (!open) return
    const porPeca = new Map<string, LinhaCarrinho[]>()
    for (const it of itens) porPeca.set(it.produto_id, [...(porPeca.get(it.produto_id) ?? []), it])
    setLinhas(
      Array.from(porPeca.values()).map((lista) => ({
        chave: lista[0].produto_id,
        produto_id: lista[0].produto_id,
        produto: lista[0].produto,
        produto_codigo: lista[0].produto_codigo,
        origens: lista.filter((l) => l.projeto_item_id),
        qtdVendas: lista.filter((l) => l.projeto_item_id).reduce((s, l) => s + l.pendente_item, 0),
        quantidade: String(Math.round(lista.reduce((s, l) => s + l.pendente_item, 0) * 1000) / 1000),
        custoLiquido: lista[0].preco_custo != null ? String(lista[0].preco_custo) : '',
        custoBase: lista[0].preco_custo != null ? String(lista[0].preco_custo) : '',
        custoManual: false,
        descontoCaixa: 0,
        stPerc: '',
        ipiPerc: '',
        outrasPerc: '',
        observacaoFornecedor: null,
        itensPorCaixa: 1,
        remover: false,
      })),
    )
    setNumero('')
    setDataPrevista('')
    setCondicoesPagamento('')
    setObservacao('')
    setEmpresaId(empresaDasVendas)
    setPerfil('')
    setDescontoPercentual('')
    setLocalEntrega('')
    setPrazoMedio(null)
    getEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
    getPrazoMedioFornecedor(fornecedorId)
      .then(setPrazoMedio)
      .catch(() => setPrazoMedio(null))
    podeEditarCaixaFechada()
      .then(setPodeEditarCaixa)
      .catch(() => setPodeEditarCaixa(false))

    // SPEC-240: arredonda a quantidade inicial para a caixa fechada da peça.
    getItensPorCaixa(Array.from(new Set(itens.map((it) => it.produto_id))))
      .then((caixas) => {
        if (caixas.size === 0) return
        setLinhas((prev) =>
          prev.map((l) => {
            const caixa = caixas.get(l.produto_id)
            if (!caixa) return l
            const qtd = parseFloat(l.quantidade) || 0
            return aplicarDescontoCaixa({
              ...l,
              itensPorCaixa: caixa,
              quantidade: String(arredondarParaCaixa(qtd, caixa)),
            })
          }),
        )
      })
      .catch(() => {
        // silencioso — sem a caixa a tela funciona como antes.
      })

    getProdutoImpostosBulk(
      Array.from(new Set(itens.map((it) => it.produto_id))),
      fornecedorId || null,
    )
      .then((impostos) => {
        setLinhas((prev) =>
          prev.map((l) => {
            const dados = impostos.get(l.produto_id)
            if (!dados) return l
            const custoLiquido = dados.custoUnitario ?? (parseFloat(l.custoLiquido) || 0)
            const custo = custoLiquido > 0 ? String(custoLiquido) : l.custoLiquido
            return aplicarDescontoCaixa({
              ...l,
              custoLiquido: custo,
              custoBase: custo,
              descontoCaixa: dados.descontoCaixaPerc,
              stPerc: percentualParaCampo(dados.porcStPerc),
              ipiPerc: percentualParaCampo(dados.ipiEntradaPerc),
              outrasPerc: percentualParaCampo(dados.despesasPerc),
              observacaoFornecedor: dados.observacaoFornecedor,
            })
          }),
        )
      })
      .catch(() => {
        // silencioso — pré-preenchimento de custo é conveniência, não obrigatório.
      })
  }, [open, itens, fornecedorId, empresaDasVendas])

  function alternarRemover(chave: string, remover: boolean) {
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, remover } : l)))
  }

  function atualizarLinha(
    chave: string,
    campo: 'quantidade' | 'custoLiquido' | 'stPerc' | 'ipiPerc' | 'outrasPerc',
    valor: string,
  ) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.chave !== chave) return l
        // SPEC-240 C: preço digitado à mão vale; mudar a quantidade reaplica o desconto da caixa
        if (campo === 'custoLiquido') return { ...l, custoLiquido: valor, custoManual: true }
        if (campo === 'quantidade') return aplicarDescontoCaixa({ ...l, quantidade: valor })
        return { ...l, [campo]: valor }
      }),
    )
  }

  async function salvarObservacao(produtoId: string, obs: string, itensPorCaixa: string, descontoCaixa: string) {
    const linha = linhas.find((l) => l.produto_id === produtoId)
    if (!linha) return
    setSalvandoObs(produtoId)
    try {
      const novaObs = obs.trim() || null
      const novaCaixa = Math.max(1, parseInt(itensPorCaixa.trim() || '1', 10) || 1)
      const novoDesconto = Math.max(0, parseFloat(descontoCaixa.trim().replace(',', '.') || '0') || 0)
      const mudouCaixa =
        podeEditarCaixa && (novaCaixa !== linha.itensPorCaixa || novoDesconto !== linha.descontoCaixa)
      // só grava a observação se mudou (não apaga a marca da SPEC-237, que fica escondida)
      if (novaObs !== linha.observacaoFornecedor) {
        await upsertObservacaoProdutoFornecedor(produtoId, fornecedorId, novaObs)
      }
      if (mudouCaixa) await salvarItensPorCaixa(produtoId, novaCaixa, novoDesconto)
      setLinhas((prev) =>
        prev.map((l) => {
          if (l.produto_id !== produtoId) return l
          const atualizada = { ...l, observacaoFornecedor: novaObs }
          if (!mudouCaixa) return atualizada
          // recalcula a linha na hora: necessidade das vendas (ou a quantidade digitada, no avulso)
          const base = l.qtdVendas > 0 ? l.qtdVendas : parseFloat(l.quantidade) || 0
          return aplicarDescontoCaixa({
            ...atualizada,
            itensPorCaixa: novaCaixa,
            descontoCaixa: novoDesconto,
            quantidade: String(arredondarParaCaixa(base, novaCaixa)),
          })
        }),
      )
      toast({ title: mudouCaixa ? 'Caixa fechada salva — vale para as próximas compras' : 'Observação salva' })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar observação',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoObs(null)
    }
  }

  const linhasValidas = linhas.map((l) => {
    const custoLiquido = parseFloat(l.custoLiquido) || 0
    const c = calcularCustoItem(custoLiquido, l)
    return {
      ...l,
      qtd: parseFloat(l.quantidade),
      custoLiquidoNum: custoLiquido,
      valorIpiNum: c.ipi,
      valorStNum: c.st,
      valorOutrasNum: c.outras,
      custo: c.total,
    }
  })

  // SPEC-212: só as linhas que não foram tiradas entram no pedido, nos totais e na validação.
  const ativas = linhasValidas.filter((l) => !l.remover)

  const todasLinhasValidas = ativas.length > 0 && ativas.every((l) => l.qtd > 0 && l.custo > 0)

  // SPEC-155 (P3): Empresa emitente obrigatória. SPEC-222 F8: condição de pagamento também.
  const canSubmit = todasLinhasValidas && !!empresaId && !!condicoesPagamento.trim() && !loading

  // SPEC-209 B5: total dos produtos (preço de custo × qtd) e total com impostos.
  const totalProdutos = ativas.reduce(
    (s, l) => (l.qtd > 0 ? s + l.qtd * l.custoLiquidoNum : s),
    0,
  )
  const totalComImpostos = ativas.reduce(
    (s, l) => (l.qtd > 0 && l.custo > 0 ? s + l.qtd * l.custo : s),
    0,
  )
  const somaImposto = (campo: 'valorStNum' | 'valorIpiNum' | 'valorOutrasNum') =>
    ativas.reduce((s, l) => (l.qtd > 0 ? s + l.qtd * l[campo] : s), 0)

  // SPEC-155 (P3, achado do revisor): clampa em [0, 100] tanto pra prévia quanto pro valor enviado.
  const descontoNum = Math.min(100, Math.max(0, parseFloat(descontoPercentual) || 0))

  const empresasDasLinhas = Array.from(
    new Set(ativas.flatMap((i) => i.origens.map((o) => o.empresa_nome)).filter(Boolean)),
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      const result = await criarPedidoCompraLote({
        fornecedor_id: fornecedorId,
        itens: ativas.map((l) => ({
          produto_id: l.produto_id,
          quantidade: l.qtd,
          custo_unitario: l.custo,
          custo_liquido: l.custoLiquidoNum || undefined,
          valor_ipi: l.valorIpiNum || undefined,
          valor_st: l.valorStNum || undefined,
          valor_outras_despesas: l.valorOutrasNum || undefined,
        })),
        numero: numero.trim() || undefined,
        data_prevista_entrega: dataPrevista || undefined,
        condicoes_pagamento: condicoesPagamento.trim() || undefined,
        observacao: observacao.trim() || undefined,
        empresa_id: empresaId,
        perfil: perfil || undefined,
        desconto_percentual: descontoNum > 0 ? descontoNum : undefined,
        local_entrega: localEntrega.trim() || undefined,
      })

      // Vínculo de origem OBRIGATÓRIO (P-03) — item da peça (por índice) ligado a cada L, repartindo a
      // quantidade comprada na ordem do carrinho.
      const falhas: string[] = []
      for (let i = 0; i < ativas.length; i++) {
        const linha = ativas[i]
        if (linha.origens.length === 0) continue
        const itemCriado = result.itens[i]
        if (!itemCriado) {
          falhas.push(`${linha.produto}: item do pedido não retornado pela API.`)
          continue
        }
        let resta = linha.qtd
        const vinculos = linha.origens
          .map((o) => {
            const q = Math.min(resta, o.pendente_item)
            resta -= q
            return { origem: o, q: Math.round(q * 1000) / 1000 }
          })
          .filter((v) => v.q > 0)
        try {
          await vincularOrigemPedidoItem(
            vinculos.map((v) => ({
              pedido_compra_item_id: itemCriado.pedido_item_id,
              projeto_item_id: v.origem.projeto_item_id!,
              quantidade_atendida: v.q,
            })),
          )
        } catch (err: any) {
          falhas.push(`${linha.produto}: ${err?.message ?? 'erro desconhecido'}`)
        }
      }

      // SPEC-209 C2: com condição de pagamento, as parcelas saem junto (previsão de pagamento).
      let avisoParcelas = ''
      if (condicoesPagamento.trim()) {
        try {
          await gerarParcelasPedidoCompra(result.pedido_id)
        } catch {
          avisoParcelas =
            ' Parcelas não geradas: condição de pagamento não reconhecida (use 30/60/90 ou datas 15/11, 15/12).'
        }
      }

      if (falhas.length > 0) {
        toast({
          title: `Pedido #${result.numero} criado, mas ${falhas.length} vínculo(s) de origem falharam`,
          description: falhas.join(' | ') + avisoParcelas,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Pedido gerado — Aguardando aprovar',
          description: `Pedido #${result.numero} com ${result.qtd_itens} item(ns).${avisoParcelas}`,
          variant: avisoParcelas ? 'destructive' : undefined,
        })
      }
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* SPEC-155 (P3, item 1): modal larga. SPEC-209 A5: arrastável pelo título. */}
      <DialogContent
        className="sm:max-w-[1440px] max-h-[92vh] overflow-y-auto p-8"
        style={arrastar.estilo}
      >
        <DialogHeader {...arrastar.alca}>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            Fechar pedido de compra — {fornecedorNome}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Arraste pelo título para ver a tela de trás. O pedido nasce em "Aguardando aprovar" e
            pode ser editado em Pedidos até o fornecedor confirmar.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs w-[150px]">Vendas</TableHead>
                  <TableHead className="text-xs w-[110px] text-right">Quantidade</TableHead>
                  {/* SPEC-209 B1/B2: sem ICMS; ordem Preço de custo · ST · IPI · Outras
                      despesas. % vem do cadastro e pode ser ajustado; o R$ aparece embaixo. */}
                  <TableHead className="text-xs w-[130px] text-right">Preço de custo (R$)</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">ST</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">IPI</TableHead>
                  <TableHead className="text-xs w-[110px] text-right">Outras despesas</TableHead>
                  <TableHead className="text-xs w-[120px] text-right">Total (R$/un.)</TableHead>
                  <TableHead className="text-xs w-[120px] text-right">Total do item (R$)</TableHead>
                  <TableHead className="text-xs w-[60px] text-center">Tirar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasValidas.map((l) => (
                  <TableRow key={l.chave} className={cn(l.remover && 'opacity-50 line-through')}>
                    <TableCell className="text-sm">
                      <p className="font-medium text-slate-800 line-clamp-1">{l.produto}</p>
                      {l.produto_codigo && (
                        <span className="font-mono text-xs text-slate-400">{l.produto_codigo}</span>
                      )}
                      <div>
                        <ObservacaoCaixaFechada
                          observacao={l.observacaoFornecedor}
                          itensPorCaixa={l.itensPorCaixa}
                          descontoCaixa={l.descontoCaixa}
                          podeEditarCaixa={podeEditarCaixa}
                          salvando={salvandoObs === l.produto_id}
                          onSalvar={(obs, qtd, desc) => salvarObservacao(l.produto_id, obs, qtd, desc)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 align-top">
                      {l.origens.length === 0 ? (
                        <span className="text-slate-400">Avulso (estoque)</span>
                      ) : (
                        <span
                          title={l.origens
                            .map((o) => `${semPrefixo(o.orcamento_numero) || '—'} ${o.l_fixo ?? ''}: ${o.pendente_item}`)
                            .join('\n')}
                        >
                          {l.origens.length} L · {l.qtdVendas} p/ vendas
                          {l.qtd > l.qtdVendas + 0.0001 && (
                            <span className="block text-[11px] text-emerald-700">
                              +{Math.round((l.qtd - l.qtdVendas) * 1000) / 1000} a mais
                              {l.itensPorCaixa > 1 ? ' (caixa fechada, estoque)' : ' (estoque)'}
                            </span>
                          )}
                          {l.qtd < l.qtdVendas - 0.0001 && l.qtd > 0 && (
                            <span className="block text-[11px] text-amber-700">
                              {Math.round((l.qtdVendas - l.qtd) * 1000) / 1000} continua na necessidade
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className={cn('h-9 text-sm text-right', NO_SPINNER)}
                        value={l.quantidade}
                        disabled={l.remover}
                        onChange={(e) => atualizarLinha(l.chave, 'quantidade', e.target.value)}
                      />
                      {/* SPEC-240: fora da caixa só avisa (às vezes o fornecedor vende avulso) */}
                      {!l.remover && l.qtd > 0 && l.itensPorCaixa > 1 && !fechaCaixa(l.qtd, l.itensPorCaixa) && (
                          <span className="block text-[11px] text-amber-700 mt-1">
                            Não fecha caixa de {l.itensPorCaixa}
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn('h-9 text-sm text-right', NO_SPINNER)}
                        value={l.custoLiquido}
                        disabled={l.remover}
                        onChange={(e) => atualizarLinha(l.chave, 'custoLiquido', e.target.value)}
                      />
                      {/* SPEC-240 C: desconto da caixa fechada */}
                      {!l.remover && l.descontoCaixa > 0 && l.itensPorCaixa > 1 && (
                        <span
                          className={cn(
                            'block text-[11px] mt-1',
                            fechaCaixa(l.qtd, l.itensPorCaixa) && !l.custoManual
                              ? 'text-emerald-700'
                              : 'text-slate-500',
                          )}
                        >
                          {fechaCaixa(l.qtd, l.itensPorCaixa) && !l.custoManual
                            ? `−${l.descontoCaixa}% caixa fechada`
                            : `Caixa fechada: −${l.descontoCaixa}%`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <CampoPercentual
                        value={l.stPerc}
                        valorReais={l.valorStNum}
                        onChange={(v) => atualizarLinha(l.chave, 'stPerc', v)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <CampoPercentual
                        value={l.ipiPerc}
                        valorReais={l.valorIpiNum}
                        onChange={(v) => atualizarLinha(l.chave, 'ipiPerc', v)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <CampoPercentual
                        value={l.outrasPerc}
                        valorReais={l.valorOutrasNum}
                        onChange={(v) => atualizarLinha(l.chave, 'outrasPerc', v)}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-700">
                      {l.custo > 0 ? brl(l.custo) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                      {l.qtd > 0 && l.custo > 0 ? brl(l.qtd * l.custo) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={l.remover}
                        onCheckedChange={(v) => alternarRemover(l.chave, v === true)}
                        aria-label="Tirar do pedido"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <TotaisCompra
            totalProdutos={totalProdutos}
            totalComImpostos={totalComImpostos}
            descontoPedidoPerc={descontoNum}
            impostos={{
              st: somaImposto('valorStNum'),
              ipi: somaImposto('valorIpiNum'),
              outras: somaImposto('valorOutrasNum'),
            }}
            desconto={
              <>
                <Label className="text-slate-600 font-normal">Desconto negociado (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  className={cn('h-8 w-24 text-right text-sm bg-white', NO_SPINNER)}
                  value={descontoPercentual}
                  onChange={(e) => setDescontoPercentual(e.target.value)}
                />
              </>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">
                Empresa <span className="text-red-500">*</span>
              </Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="h-11 text-sm">
                  <SelectValue placeholder="Selecione a empresa que está comprando..." />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {empresasDasLinhas.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  Empresa da venda: {empresasDasLinhas.join(', ')}
                  {empresasDasLinhas.length > 1 && ' — itens de empresas diferentes neste pedido'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Perfil (opcional)</Label>
              <Select value={perfil} onValueChange={setPerfil}>
                <SelectTrigger className="h-11 text-sm">
                  <SelectValue placeholder="Não informado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ribeirao">Ribeirão</SelectItem>
                  <SelectItem value="sao_paulo">São Paulo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Local de entrega (opcional)</Label>
              <Input
                placeholder="ex: Depósito Ribeirão Preto"
                className="h-11 text-sm"
                value={localEntrega}
                onChange={(e) => setLocalEntrega(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Data prevista de entrega (opcional)</Label>
              <Input
                type="date"
                className="h-11 text-sm"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
              {/* SPEC-209 C4: só aparece quando já há pedidos deste fornecedor com entrada. */}
              {prazoMedio && (
                <p className="text-[11px] text-slate-500">
                  Prazo médio deste fornecedor: {prazoMedio.dias} dia(s) (base: {prazoMedio.pedidos}{' '}
                  pedido(s) entregue(s))
                </p>
              )}
            </div>
            <CondicaoPagamentoCampo value={condicoesPagamento} onChange={setCondicoesPagamento} />
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Nº do pedido / referência (opcional)</Label>
              <Input
                placeholder="Gerado automaticamente se deixado em branco"
                className="h-11 text-sm"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Observação (opcional)</Label>
              <Textarea
                placeholder="Observações adicionais..."
                className="text-sm resize-none"
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px] h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Confirmar pedido ({ativas.length} {ativas.length === 1 ? 'peça' : 'peças'})
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
