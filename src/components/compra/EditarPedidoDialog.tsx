import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Loader2, Pencil, Plus, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { buscarProdutosParaPedido, type EstoqueProdutoRow } from '@/services/estoque-produtos'
import {
  arredondarParaCaixa,
  editarPedidoCompra,
  fechaCaixa,
  getEmpresas,
  getItensDoPedido,
  getItensPorCaixa,
  getProdutoImpostos,
  type Empresa,
  type EditarPedidoItem,
  type PedidoCompraRow,
} from '@/services/pedido-compra'
import {
  CampoPercentual,
  TotaisCompra,
  brl,
  calcularCustoItem,
  lerNumero,
  percentualParaCampo,
} from '@/components/compra/custo-compra'
import { CondicaoPagamentoCampo } from '@/components/compra/CondicaoPagamentoCampo'
import { useArrastavel } from '@/components/compra/use-arrastavel'

// SPEC-209 D3: o fornecedor respondeu (mudou quantidade, deu desconto, faltou item...) e a Débora
// ajusta o pedido antes de aprovar. Só vale para "Aguardando aprovar" (o banco também barra).

// SPEC-213: a mesma peça (vários L) aparece numa linha só, com a quantidade somada. Por baixo, cada
// L continua sendo um item do pedido (o vínculo com a venda é por item), então ao salvar a quantidade
// total é redistribuída: o que aumentar vai para a primeira linha; o que diminuir sai das últimas
// (linha que zera é tirada e a necessidade daquele L volta a aparecer).
interface ParteLinha {
  id: string
  quantidade: number
  ls: string[]
}

interface LinhaEdicao {
  id: string
  partes: ParteLinha[]
  produto: string
  codigo: string | null
  quantidade: string
  custoLiquido: string
  stPerc: string
  ipiPerc: string
  outrasPerc: string
  remover: boolean
  // SPEC-263 B: peça incluída agora (não existe ainda no pedido).
  nova?: boolean
  custoBase?: string
  custoManual?: boolean
  descontoCaixa?: number
  itensPorCaixa?: number
}

// SPEC-240 C: com desconto de caixa fechada o custo vem com o desconto enquanto a quantidade fecha caixa.
function comDescontoCaixa(l: LinhaEdicao): LinhaEdicao {
  if (l.custoManual || !((l.descontoCaixa ?? 0) > 0)) return l
  const base = parseFloat(l.custoBase ?? '')
  if (!(base > 0)) return l
  const custo = fechaCaixa(lerNumero(l.quantidade), l.itensPorCaixa ?? 0)
    ? Math.round(base * (1 - (l.descontoCaixa ?? 0) / 100) * 10000) / 10000
    : base
  return { ...l, custoLiquido: String(custo) }
}

function distribuir(partes: ParteLinha[], total: number): { id: string; quantidade: number }[] {
  const soma = partes.reduce((s, p) => s + p.quantidade, 0)
  const qtds = partes.map((p) => p.quantidade)
  if (total >= soma) {
    qtds[0] += total - soma
  } else {
    let falta = soma - total
    for (let i = qtds.length - 1; i >= 0 && falta > 0; i--) {
      const tira = Math.min(qtds[i], falta)
      qtds[i] -= tira
      falta -= tira
    }
  }
  return partes.map((p, i) => ({ id: p.id, quantidade: Math.round(qtds[i] * 1000) / 1000 }))
}

function percentualDoValor(valor: number | null, base: number): string {
  if (valor == null || !base) return ''
  const p = Math.round((valor / base) * 100 * 100) / 100
  return p ? String(p).replace('.', ',') : ''
}

export function EditarPedidoDialog({
  pedido,
  onOpenChange,
  onSalvo,
}: {
  pedido: PedidoCompraRow | null
  onOpenChange: (open: boolean) => void
  onSalvo: () => void
}) {
  const { toast } = useToast()
  const arrastar = useArrastavel(pedido?.id)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [desconto, setDesconto] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [condicoes, setCondicoes] = useState('')
  const [localEntrega, setLocalEntrega] = useState('')
  const [observacao, setObservacao] = useState('')
  // SPEC-263 C: valor final negociado (R$) — vazio = vale o desconto %
  const [valorNegociado, setValorNegociado] = useState('')
  // SPEC-263 B: busca de peça para incluir
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<EstoqueProdutoRow[]>([])

  useEffect(() => {
    if (!busca.trim()) {
      setResultados([])
      return
    }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        setResultados((await buscarProdutosParaPedido(busca, 8)) ?? [])
      } catch (err: any) {
        toast({ title: 'Erro na busca', description: err?.message, variant: 'destructive' })
      } finally {
        setBuscando(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [busca, toast])

  useEffect(() => {
    if (!pedido) return
    setBusca('')
    setValorNegociado(pedido.valor_negociado ? String(pedido.valor_negociado).replace('.', ',') : '')
    setEmpresaId(pedido.empresa_id ?? '')
    setDesconto(pedido.desconto_percentual ? String(pedido.desconto_percentual) : '')
    setDataPrevista(pedido.data_prevista_entrega ?? '')
    setCondicoes(pedido.condicoes_pagamento ?? '')
    setLocalEntrega(pedido.local_entrega ?? '')
    setObservacao(pedido.observacao ?? '')
    getEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
    setCarregando(true)
    getItensDoPedido(pedido.id)
      .then((itens) => {
        // SPEC-213: agrupa por peça, na ordem em que aparece no pedido
        const grupos = new Map<string, typeof itens>()
        for (const i of itens) grupos.set(i.produto_id, [...(grupos.get(i.produto_id) ?? []), i])
        setLinhas(
          Array.from(grupos.values()).map((grupo) => {
            const i = grupo[0]
            const base = i.custo_liquido ?? i.custo_unitario
            return {
              id: i.produto_id,
              partes: grupo.map((g) => ({ id: g.id, quantidade: g.quantidade, ls: g.ls })),
              produto: i.produto_nome,
              codigo: i.produto_codigo,
              quantidade: String(grupo.reduce((s, g) => s + g.quantidade, 0)),
              custoLiquido: String(base),
              stPerc: percentualDoValor(i.valor_st, base),
              ipiPerc: percentualDoValor(i.valor_ipi, base),
              outrasPerc: percentualDoValor(i.valor_outras_despesas, base),
              remover: false,
            }
          }),
        )
      })
      .catch((err) =>
        toast({
          title: 'Erro ao carregar itens do pedido',
          description: err?.message,
          variant: 'destructive',
        }),
      )
      .finally(() => setCarregando(false))
  }, [pedido, toast])

  function mudar(id: string, campo: keyof LinhaEdicao, valor: string | boolean) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const nova = { ...l, [campo]: valor } as LinhaEdicao
        if (!l.nova) return nova
        if (campo === 'custoLiquido') return { ...nova, custoManual: true }
        if (campo === 'quantidade') return comDescontoCaixa(nova)
        return nova
      }),
    )
  }

  // SPEC-263 B: inclui uma peça nova no pedido (custo, ST, IPI e caixa fechada vêm do cadastro).
  async function incluirPeca(p: EstoqueProdutoRow) {
    if (!pedido) return
    if (linhas.some((l) => l.id === p.produto_id)) {
      toast({
        title: 'Essa peça já está no pedido',
        description: 'Altere a quantidade da linha que já existe.',
      })
      return
    }
    setBusca('')
    setResultados([])
    try {
      const [dados, caixas] = await Promise.all([
        getProdutoImpostos(p.produto_id, pedido.fornecedor_id).catch(() => null),
        getItensPorCaixa([p.produto_id]).catch(() => new Map<string, number>()),
      ])
      const caixa = caixas.get(p.produto_id) ?? 0
      const custo = dados?.custoUnitario ?? 0
      const base = custo > 0 ? String(custo) : ''
      const linha = comDescontoCaixa({
        id: p.produto_id,
        partes: [],
        produto: p.produto,
        codigo: p.produto_codigo != null ? String(p.produto_codigo) : null,
        quantidade: String(arredondarParaCaixa(1, caixa)),
        custoLiquido: base,
        stPerc: percentualParaCampo(dados?.porcStPerc),
        ipiPerc: percentualParaCampo(dados?.ipiEntradaPerc),
        outrasPerc: percentualParaCampo(dados?.despesasPerc),
        remover: false,
        nova: true,
        custoBase: base,
        custoManual: false,
        descontoCaixa: dados?.descontoCaixaPerc ?? 0,
        itensPorCaixa: caixa,
      })
      setLinhas((prev) => [...prev, linha])
    } catch (err: any) {
      toast({ title: 'Não foi possível incluir a peça', description: err?.message, variant: 'destructive' })
    }
  }

  const calculadas = linhas.map((l) => {
    const custo = lerNumero(l.custoLiquido)
    return { ...l, qtd: lerNumero(l.quantidade), custo, c: calcularCustoItem(custo, l) }
  })
  const ativas = calculadas.filter((l) => !l.remover)
  const totalProdutos = ativas.reduce((s, l) => s + l.qtd * l.custo, 0)
  const totalComImpostos = ativas.reduce((s, l) => s + l.qtd * l.c.total, 0)
  // SPEC-263 C: com valor negociado, o total é esse valor e o desconto % é só o equivalente
  const negociadoNum = lerNumero(valorNegociado)
  const negociadoAtivo = negociadoNum > 0
  const negociadoAcimaDoTotal =
    negociadoAtivo && negociadoNum > Math.round(totalComImpostos * 100) / 100 + 0.004
  const descontoManual = Math.min(100, Math.max(0, lerNumero(desconto)))
  const descontoNum =
    negociadoAtivo && totalComImpostos > 0 && !negociadoAcimaDoTotal
      ? Math.round((1 - negociadoNum / totalComImpostos) * 10000) / 100
      : negociadoAtivo
        ? 0
        : descontoManual
  // SPEC-222 F8: condição de pagamento obrigatória
  const valido =
    ativas.length > 0 &&
    ativas.every((l) => l.qtd > 0 && l.c.total > 0) &&
    !!condicoes.trim() &&
    !negociadoAcimaDoTotal

  async function salvar() {
    if (!pedido || !valido) return
    setSalvando(true)
    try {
      const r = await editarPedidoCompra({
        pedido_id: pedido.id,
        itens: calculadas.flatMap((l): EditarPedidoItem[] =>
          l.nova
            ? l.remover
              ? []
              : [
                  {
                    produto_id: l.id,
                    quantidade: l.qtd,
                    custo_unitario: l.c.total,
                    custo_liquido: l.custo || null,
                    valor_ipi: l.c.ipi || null,
                    valor_st: l.c.st || null,
                    valor_outras_despesas: l.c.outras || null,
                  },
                ]
            : l.remover
            ? l.partes.map((p) => ({ pedido_item_id: p.id, remover: true }))
            : distribuir(l.partes, l.qtd).map((p) =>
                p.quantidade <= 0
                  ? { pedido_item_id: p.id, remover: true }
                  : {
                      pedido_item_id: p.id,
                      quantidade: p.quantidade,
                      custo_unitario: l.c.total,
                      custo_liquido: l.custo || null,
                      valor_ipi: l.c.ipi || null,
                      valor_st: l.c.st || null,
                      valor_outras_despesas: l.c.outras || null,
                    },
              ),
        ),
        data_prevista_entrega: dataPrevista || null,
        condicoes_pagamento: condicoes,
        observacao,
        desconto_percentual: negociadoAtivo ? null : descontoManual || null,
        valor_negociado: negociadoAtivo ? negociadoNum : null,
        empresa_id: empresaId || null,
        local_entrega: localEntrega,
      })
      toast({
        title: `Pedido #${pedido.numero} atualizado`,
        description:
          `Novo total: ${brl(Number(r.valor_total) || 0)}` +
          (r.parcelas_criadas ? ` · ${r.parcelas_criadas} parcela(s) refeitas` : ''),
      })
      onSalvo()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar o pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={pedido != null} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[1200px] max-h-[92vh] overflow-y-auto p-8"
        style={arrastar.estilo}
      >
        <DialogHeader {...arrastar.alca}>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4 text-amber-600" />
            Editar pedido #{pedido?.numero} — {pedido?.fornecedor_nome}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Ajuste o que o fornecedor respondeu antes de aprovar. A mesma peça de vários L aparece numa
            linha só, com a quantidade somada: se diminuir, a diferença sai dos últimos L da lista (a
            necessidade deles volta a aparecer). Marque "Tirar" para retirar a peça. Arraste pelo título
            para ver a tela de trás.
          </p>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* SPEC-263 B: incluir peça nova no pedido */}
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Incluir peça neste pedido: buscar por nome, código, referência ou marca..."
                className="pl-9 h-9 text-sm"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca.trim() && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-64">
                  {buscando ? (
                    <div className="p-3 flex justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                  ) : resultados.length === 0 ? (
                    <p className="p-3 text-sm text-slate-400">Nenhuma peça encontrada.</p>
                  ) : (
                    resultados.map((r) => {
                      const jaNoPedido = linhas.some((l) => l.id === r.produto_id)
                      return (
                        <button
                          key={r.produto_id}
                          type="button"
                          disabled={jaNoPedido}
                          className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 disabled:opacity-50"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            incluirPeca(r)
                          }}
                        >
                          <span className="min-w-0">
                            <span className="font-mono text-xs text-slate-400 mr-2">{r.produto_codigo}</span>
                            <span className="line-clamp-1">{r.produto}</span>
                            {r.marca && <span className="text-[11px] text-slate-400 ml-2">{r.marca}</span>}
                          </span>
                          <span className="shrink-0 text-xs text-emerald-700 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" />
                            {jaNoPedido ? 'No pedido' : 'Incluir'}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Quantidade</TableHead>
                    <TableHead className="text-xs w-[120px] text-right">Preço de custo (R$)</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">ST</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">IPI</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Outras despesas</TableHead>
                    <TableHead className="text-xs w-[110px] text-right">Total (R$/un.)</TableHead>
                    <TableHead className="text-xs w-[120px] text-right">Total do item (R$)</TableHead>
                    <TableHead className="text-xs w-[60px] text-center">Tirar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculadas.map((l) => (
                    <TableRow key={l.id} className={cn(l.remover && 'opacity-50 line-through')}>
                      <TableCell className="text-sm">
                        <p className="font-medium text-slate-800 line-clamp-1">{l.produto}</p>
                        {l.codigo && (
                          <span className="font-mono text-xs text-slate-400">{l.codigo}</span>
                        )}
                        {l.nova && (
                          <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Nova
                          </span>
                        )}
                        {/* SPEC-213: de quais L vem a quantidade somada */}
                        {l.partes.some((p) => p.ls.length > 0) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {l.partes
                              .map((p) => `${p.ls.join('/') || 'sem L'}: ${p.quantidade.toLocaleString('pt-BR')}`)
                              .join(' · ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9 text-sm text-right"
                          value={l.quantidade}
                          disabled={l.remover}
                          onChange={(e) => mudar(l.id, 'quantidade', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9 text-sm text-right"
                          value={l.custoLiquido}
                          disabled={l.remover}
                          onChange={(e) => mudar(l.id, 'custoLiquido', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <CampoPercentual
                          value={l.stPerc}
                          valorReais={l.c.st}
                          onChange={(v) => mudar(l.id, 'stPerc', v)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <CampoPercentual
                          value={l.ipiPerc}
                          valorReais={l.c.ipi}
                          onChange={(v) => mudar(l.id, 'ipiPerc', v)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <CampoPercentual
                          value={l.outrasPerc}
                          valorReais={l.c.outras}
                          onChange={(v) => mudar(l.id, 'outrasPerc', v)}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-slate-700">
                        {l.c.total > 0 ? brl(l.c.total) : '—'}
                      </TableCell>
                      {/* quantidade × total por unidade (com impostos) */}
                      <TableCell className="text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                        {l.qtd > 0 && l.c.total > 0 ? brl(l.qtd * l.c.total) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={l.remover}
                          onCheckedChange={(v) => mudar(l.id, 'remover', v === true)}
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
                st: ativas.reduce((s, l) => s + l.qtd * l.c.st, 0),
                ipi: ativas.reduce((s, l) => s + l.qtd * l.c.ipi, 0),
                outras: ativas.reduce((s, l) => s + l.qtd * l.c.outras, 0),
              }}
              desconto={
                <>
                  <Label className="text-slate-600 font-normal">Desconto do pedido (%)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    className="h-8 w-24 text-right text-sm bg-white"
                    value={negociadoAtivo ? String(descontoNum).replace('.', ',') : desconto}
                    disabled={negociadoAtivo}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </>
              }
            />

            {/* SPEC-263 C: valor final combinado com o fornecedor */}
            <div className="ml-auto w-full sm:w-[420px] rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <Label className="text-slate-700 font-medium">Valor final negociado (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="opcional"
                  className="h-8 w-36 text-right text-sm bg-white"
                  value={valorNegociado}
                  onChange={(e) => setValorNegociado(e.target.value)}
                />
              </div>
              {negociadoAcimaDoTotal ? (
                <p className="text-xs text-red-600">
                  O valor negociado não pode ser maior que o total do pedido ({brl(totalComImpostos)}).
                </p>
              ) : negociadoAtivo ? (
                <p className="text-xs text-emerald-700">
                  Total do pedido fica em <b>{brl(negociadoNum)}</b> — desconto de {String(descontoNum).replace('.', ',')}%
                  (economia de {brl(totalComImpostos - negociadoNum)}). Apague o campo para voltar ao desconto em %.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Preencha quando o fornecedor fechou um valor final com desconto: o total do pedido passa a ser
                  exatamente esse valor.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Empresa que está comprando" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Data prevista de entrega</Label>
                <Input
                  type="date"
                  className="h-10 text-sm"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                />
              </div>
              <CondicaoPagamentoCampo value={condicoes} onChange={setCondicoes} />
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Local de entrega</Label>
                <Input
                  className="h-10 text-sm"
                  value={localEntrega}
                  onChange={(e) => setLocalEntrega(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Observação</Label>
                <Textarea
                  rows={2}
                  className="text-sm resize-none"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Voltar
          </Button>
          <Button
            onClick={salvar}
            disabled={!valido || salvando || carregando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]"
          >
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
