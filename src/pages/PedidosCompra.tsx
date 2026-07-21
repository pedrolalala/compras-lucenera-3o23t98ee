import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, X, RefreshCw, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/StatusBadge'
import { PedidoParcelasPanel } from '@/components/compra/PedidoParcelasPanel'
import { getPedidosCompra, type PedidoCompraRow } from '@/services/pedido-compra'

function fmtBRL(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export default function PedidosCompra() {
  const { toast } = useToast()

  const [rows, setRows] = useState<PedidoCompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPedidosCompra(debouncedSearch || undefined)
      setRows(data)
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar pedidos.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  function toggleExpand(pedidoId: string) {
    setExpandedId((prev) => (prev === pedidoId ? null : pedidoId))
  }

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 xl:h-[calc(100vh-130px)] animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Pedidos de Compra
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Pedidos registrados a fornecedores — gere e edite as parcelas de pagamento (SPEC-038).
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          className="shadow-sm w-full sm:w-auto"
          disabled={loading}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número do pedido..."
              className="pl-9 bg-slate-50 border-slate-200 h-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('')
                setDebouncedSearch('')
              }}
              className="shrink-0 text-slate-500 hover:text-slate-700 h-9"
            >
              <X className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
          {loading ? 'Carregando...' : `${rows.length} pedido(s)`}
        </div>

        <div className="overflow-auto flex-1">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="w-[4%] pl-4 sm:pl-6" />
                <TableHead className="w-[14%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Número
                </TableHead>
                <TableHead className="text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Fornecedor
                </TableHead>
                <TableHead className="w-[12%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Emissão
                </TableHead>
                <TableHead className="w-[13%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Condições
                </TableHead>
                <TableHead className="w-[12%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Valor Total
                </TableHead>
                <TableHead className="w-[10%] pr-4 sm:pr-6 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500">Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <ShoppingCart className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">Nenhum pedido de compra ainda</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.flatMap((r) => {
                  const isExpanded = expandedId === r.id
                  const rowEl = (
                    <TableRow
                      key={r.id}
                      onClick={() => toggleExpand(r.id)}
                      className="cursor-pointer transition-colors h-14 border-b border-slate-50 hover:bg-slate-50/80"
                    >
                      <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {r.numero}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <span className="text-sm text-slate-700 line-clamp-1">
                          {r.fornecedor_nome}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <span className="text-xs text-slate-500">{fmtDate(r.data_emissao)}</span>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <span className="text-xs text-slate-500 line-clamp-1">
                          {r.condicoes_pagamento ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-middle py-2">
                        <span className="text-sm font-semibold text-slate-700">
                          {fmtBRL(r.valor_total)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-6 align-middle py-2">
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  )
                  const detailRow = isExpanded ? (
                    <TableRow key={`${r.id}-detalhe`} className="hover:bg-transparent">
                      <TableCell colSpan={7} className="p-0">
                        <PedidoParcelasPanel
                          pedidoId={r.id}
                          pedidoNumero={r.numero}
                          condicoesPagamento={r.condicoes_pagamento}
                          valorTotal={r.valor_total}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null
                  return detailRow ? [rowEl, detailRow] : [rowEl]
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
