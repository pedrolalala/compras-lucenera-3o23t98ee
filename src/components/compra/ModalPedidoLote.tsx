import { useState, useEffect } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, PackageCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  criarPedidoCompraLote,
  getProdutoImpostosBulk,
  gerarParcelasPedidoCompra,
} from '@/services/pedido-compra'
import type { NecessidadeCompraRow } from '@/services/necessidade-compra'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  itens: NecessidadeCompraRow[]
  fornecedorId: string
  fornecedorNome: string
  onSuccess: () => void
}

interface LinhaLote {
  produto_id: string
  produto: string
  produto_codigo: string | null
  quantidade: string
  // SPEC-038 Item 1: custo unitário separado em líquido + ICMS + IPI + ST
  custoLiquido: string
  valorIcms: string
  valorIpi: string
  valorSt: string
  // SPEC-033: contexto de estoque exibido junto ao campo de quantidade —
  // já vem na prop `itens` (NecessidadeCompraRow), sem nova query.
  qtdFisica: number
  qtdComprometida: number
  qtdDisponivel: number
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

export function ModalPedidoLote({
  open,
  onOpenChange,
  itens,
  fornecedorId,
  fornecedorNome,
  onSuccess,
}: Props) {
  const { toast } = useToast()

  const [linhas, setLinhas] = useState<LinhaLote[]>([])
  const [numero, setNumero] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [condicoesPagamento, setCondicoesPagamento] = useState('')
  const [gerarParcelas, setGerarParcelas] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLinhas(
      itens.map((it) => ({
        produto_id: it.produto_id,
        produto: it.produto,
        produto_codigo: it.produto_codigo,
        quantidade: String(it.necessidade_compra),
        custoLiquido: it.preco_custo != null ? String(it.preco_custo) : '',
        valorIcms: '',
        valorIpi: '',
        valorSt: '',
        qtdFisica: it.qtd_fisica,
        qtdComprometida: it.qtd_comprometida,
        qtdDisponivel: it.qtd_disponivel,
      })),
    )
    setNumero('')
    setDataPrevista('')
    setCondicoesPagamento('')
    setGerarParcelas(false)
    setObservacao('')

    // SPEC-038 Item 1 (P-02): pré-preenche custo líquido + ICMS/IPI/ST em
    // lote a partir de produtos/produto_fornecedores (1 fornecedor fixo).
    getProdutoImpostosBulk(
      itens.map((it) => it.produto_id),
      fornecedorId || null,
    )
      .then((impostos) => {
        setLinhas((prev) =>
          prev.map((l) => {
            const dados = impostos.get(l.produto_id)
            if (!dados) return l
            const custoLiquido = dados.custoUnitario ?? (parseFloat(l.custoLiquido) || 0)
            const icms =
              custoLiquido > 0 ? round4((custoLiquido * (dados.icmsEntradaPerc ?? 0)) / 100) : 0
            const ipi =
              custoLiquido > 0 ? round4((custoLiquido * (dados.ipiEntradaPerc ?? 0)) / 100) : 0
            const st = custoLiquido > 0 ? round4((custoLiquido * (dados.porcStPerc ?? 0)) / 100) : 0
            return {
              ...l,
              custoLiquido: custoLiquido > 0 ? String(custoLiquido) : l.custoLiquido,
              valorIcms: String(icms),
              valorIpi: String(ipi),
              valorSt: String(st),
            }
          }),
        )
      })
      .catch(() => {
        // silencioso — campos continuam editáveis manualmente
      })
  }, [open, itens, fornecedorId])

  function atualizarLinha(
    produtoId: string,
    campo: 'quantidade' | 'custoLiquido' | 'valorIcms' | 'valorIpi' | 'valorSt',
    valor: string,
  ) {
    setLinhas((prev) =>
      prev.map((l) => (l.produto_id === produtoId ? { ...l, [campo]: valor } : l)),
    )
  }

  const linhasValidas = linhas.map((l) => {
    const custoLiquido = parseFloat(l.custoLiquido) || 0
    const valorIcms = parseFloat(l.valorIcms) || 0
    const valorIpi = parseFloat(l.valorIpi) || 0
    const valorSt = parseFloat(l.valorSt) || 0
    return {
      ...l,
      qtd: parseFloat(l.quantidade),
      custoLiquidoNum: custoLiquido,
      valorIcmsNum: valorIcms,
      valorIpiNum: valorIpi,
      valorStNum: valorSt,
      custo: custoLiquido + valorIcms + valorIpi + valorSt,
    }
  })

  const todasLinhasValidas =
    linhasValidas.length > 0 && linhasValidas.every((l) => l.qtd > 0 && l.custo > 0)

  const canSubmit = todasLinhasValidas && !loading

  const totalEstimado = linhasValidas.reduce(
    (s, l) => (l.qtd > 0 && l.custo > 0 ? s + l.qtd * l.custo : s),
    0,
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      const result = await criarPedidoCompraLote({
        fornecedor_id: fornecedorId,
        itens: linhasValidas.map((l) => ({
          produto_id: l.produto_id,
          quantidade: l.qtd,
          custo_unitario: l.custo,
          custo_liquido: l.custoLiquidoNum || undefined,
          valor_icms: l.valorIcmsNum || undefined,
          valor_ipi: l.valorIpiNum || undefined,
          valor_st: l.valorStNum || undefined,
        })),
        numero: numero.trim() || undefined,
        data_prevista_entrega: dataPrevista || undefined,
        condicoes_pagamento: condicoesPagamento.trim() || undefined,
        observacao: observacao.trim() || undefined,
      })

      if (gerarParcelas && condicoesPagamento.trim()) {
        try {
          await gerarParcelasPedidoCompra(result.pedido_id)
        } catch (err: any) {
          toast({
            title: 'Pedido criado, mas parcelas não foram geradas',
            description:
              err?.message ??
              'Condições de pagamento não puderam ser interpretadas. Gere as parcelas manualmente.',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: 'Pedido em lote registrado',
        description: `Pedido #${result.numero} criado com ${result.qtd_itens} item(ns).`,
      })
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar pedido em lote',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            Pedido em Lote — {fornecedorNome}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs w-[110px] text-right">Quantidade</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">Líquido (R$)</TableHead>
                  <TableHead className="text-xs w-[90px] text-right">ICMS (R$)</TableHead>
                  <TableHead className="text-xs w-[90px] text-right">IPI (R$)</TableHead>
                  <TableHead className="text-xs w-[90px] text-right">ST (R$)</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">Total (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasValidas.map((l) => (
                  <TableRow key={l.produto_id}>
                    <TableCell className="text-sm">
                      <p className="font-medium text-slate-800 line-clamp-1">{l.produto}</p>
                      {l.produto_codigo && (
                        <span className="font-mono text-xs text-slate-400">{l.produto_codigo}</span>
                      )}
                      <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>
                          Física: <span className="font-medium text-slate-700">{l.qtdFisica}</span>
                        </span>
                        <span>
                          Comprometida:{' '}
                          <span className="font-medium text-amber-700">{l.qtdComprometida}</span>
                        </span>
                        <span>
                          Disponível:{' '}
                          <span
                            className={cn(
                              'font-semibold',
                              l.qtdDisponivel < 0 ? 'text-red-600' : 'text-emerald-700',
                            )}
                          >
                            {l.qtdDisponivel}
                          </span>
                        </span>
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className="h-9 text-sm text-right"
                        value={l.quantidade}
                        onChange={(e) => atualizarLinha(l.produto_id, 'quantidade', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-9 text-sm text-right"
                        value={l.custoLiquido}
                        onChange={(e) =>
                          atualizarLinha(l.produto_id, 'custoLiquido', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-9 text-sm text-right"
                        value={l.valorIcms}
                        onChange={(e) => atualizarLinha(l.produto_id, 'valorIcms', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-9 text-sm text-right"
                        value={l.valorIpi}
                        onChange={(e) => atualizarLinha(l.produto_id, 'valorIpi', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-9 text-sm text-right"
                        value={l.valorSt}
                        onChange={(e) => atualizarLinha(l.produto_id, 'valorSt', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-700">
                      {l.custo > 0
                        ? l.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalEstimado > 0 && (
            <p className="text-sm text-slate-500 text-right -mt-2">
              Total estimado:{' '}
              <span className="font-semibold text-slate-700">
                {totalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Nº do pedido / referência (opcional)</Label>
            <Input
              placeholder="Gerado automaticamente se deixado em branco (ex: PC-2026-0001)"
              className="h-11 text-sm"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
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
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Condições de pagamento (opcional)</Label>
            <Input
              placeholder="ex: 30/60/90 dias"
              className="h-11 text-sm"
              value={condicoesPagamento}
              onChange={(e) => setCondicoesPagamento(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 pt-1">
              <Checkbox
                checked={gerarParcelas}
                disabled={!condicoesPagamento.trim()}
                onCheckedChange={(checked) => setGerarParcelas(checked === true)}
              />
              Gerar parcelas automaticamente ao registrar o pedido (editáveis depois)
            </label>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Observação (opcional)</Label>
            <Textarea
              placeholder="Observações adicionais..."
              className="text-sm resize-none"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-4 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px] h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Confirmar Pedido em Lote
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
