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
import { criarPedidoCompraLote } from '@/services/pedido-compra'
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
  custoUnitario: string
  // SPEC-033: contexto de estoque exibido junto ao campo de quantidade —
  // já vem na prop `itens` (NecessidadeCompraRow), sem nova query.
  qtdFisica: number
  qtdComprometida: number
  qtdDisponivel: number
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
        custoUnitario: it.preco_custo != null ? String(it.preco_custo) : '',
        qtdFisica: it.qtd_fisica,
        qtdComprometida: it.qtd_comprometida,
        qtdDisponivel: it.qtd_disponivel,
      })),
    )
    setNumero('')
    setDataPrevista('')
    setCondicoesPagamento('')
    setObservacao('')
  }, [open, itens])

  function atualizarLinha(produtoId: string, campo: 'quantidade' | 'custoUnitario', valor: string) {
    setLinhas((prev) =>
      prev.map((l) => (l.produto_id === produtoId ? { ...l, [campo]: valor } : l)),
    )
  }

  const linhasValidas = linhas.map((l) => ({
    ...l,
    qtd: parseFloat(l.quantidade),
    custo: parseFloat(l.custoUnitario),
  }))

  const todasLinhasValidas =
    linhasValidas.length > 0 && linhasValidas.every((l) => l.qtd > 0 && l.custo > 0)

  const canSubmit = todasLinhasValidas && numero.trim().length > 0 && !loading

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
        })),
        numero: numero.trim(),
        data_prevista_entrega: dataPrevista || undefined,
        condicoes_pagamento: condicoesPagamento.trim() || undefined,
        observacao: observacao.trim() || undefined,
      })
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
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            Pedido em Lote — {fornecedorNome}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs w-[140px] text-right">Quantidade</TableHead>
                  <TableHead className="text-xs w-[160px] text-right">Custo unitário (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.produto_id}>
                    <TableCell className="text-sm">
                      <p className="font-medium text-slate-800 line-clamp-1">{l.produto}</p>
                      {l.produto_codigo && (
                        <span className="font-mono text-xs text-slate-400">
                          {l.produto_codigo}
                        </span>
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
                        onChange={(e) =>
                          atualizarLinha(l.produto_id, 'quantidade', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="h-9 text-sm text-right"
                        value={l.custoUnitario}
                        onChange={(e) =>
                          atualizarLinha(l.produto_id, 'custoUnitario', e.target.value)
                        }
                      />
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
            <Label className="text-sm text-slate-600">
              Nº do pedido / referência <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="ex: PC-2026-001"
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
