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
import { Search, X, RefreshCw, RotateCcw, PackageOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ModalDevolucaoItem } from '@/components/compra/ModalDevolucaoItem'
import {
  getItensComSaldoParaDevolucao,
  type DevolucaoSaldoItemRow,
  type ProgressInfo,
} from '@/services/devolucoes'

// SPEC-054 — Interface de Devolução de Estoque (linhas manuais por setor de
// origem). Segue o mesmo padrão visual/de estado de
// NecessidadeCompraPorItemTab.tsx (SPEC-040): busca debounced, paginação em
// lote, scroll infinito. Granularidade: 1 linha por projeto_item_id com
// saldo aberto em pelo menos um dos 3 setores (Entrega Futura / Reserva /
// Entregue), não "necessidade de compra pendente".
//
// Sem restrição de papel/permissão — decisão já registrada na SPEC-054
// (aberto a qualquer usuário autenticado, mesmo padrão da RPC original de
// devolução, SPEC-015).

const VISIBLE_BATCH = 100

export function DevolucaoEstoqueTab() {
  const { toast } = useToast()

  const [rows, setRows] = useState<DevolucaoSaldoItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [itemSelecionado, setItemSelecionado] = useState<DevolucaoSaldoItemRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    setProgress(null)
    try {
      const data = await getItensComSaldoParaDevolucao(debouncedSearch || undefined, (info) => {
        setProgress(info)
      })
      setRows(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar itens com saldo para devolução.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [debouncedSearch, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setVisibleCount(VISIBLE_BATCH)
  }, [debouncedSearch])

  const visibleRows = rows.slice(0, visibleCount)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && visibleCount < rows.length) {
      setVisibleCount((prev) => Math.min(prev + VISIBLE_BATCH, rows.length))
    }
  }

  function abrirDevolucao(row: DevolucaoSaldoItemRow) {
    setItemSelecionado(row)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <p className="text-slate-500 text-sm">
          Itens de projeto com saldo aberto em Entrega Futura, Reserva ou Entregue — lance uma linha
          por setor de origem para registrar a devolução.
        </p>
        <Button
          variant="outline"
          onClick={loadData}
          className="shadow-sm w-full sm:w-auto shrink-0"
          disabled={loading}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou código do produto..."
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
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
          {loading
            ? progress
              ? `Carregando... ${progress.loaded} de ${progress.total} itens`
              : 'Carregando...'
            : `${visibleRows.length} de ${rows.length} item(ns) com saldo aberto`}
        </div>
        <div className="overflow-auto flex-1" onScroll={handleScroll}>
          <Table className="min-w-[1100px] w-full table-fixed">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="w-[130px] pl-4 sm:pl-6 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Orçamento
                </TableHead>
                <TableHead className="w-[100px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Código
                </TableHead>
                <TableHead className="w-[280px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Produto
                </TableHead>
                <TableHead className="w-[130px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Entrega Futura
                </TableHead>
                <TableHead className="w-[110px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Reserva
                </TableHead>
                <TableHead className="w-[110px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Entregue
                </TableHead>
                <TableHead className="w-[130px] pr-4 sm:pr-6 text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Ação
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
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <PackageOpen className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">
                        {searchInput ? 'Nenhum item encontrado' : 'Nenhum item com saldo aberto'}
                      </p>
                      <p className="text-sm mt-1">
                        {searchInput
                          ? 'Tente ajustar a busca.'
                          : 'Não há itens com saldo em Entrega Futura, Reserva ou Entregue no momento.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r) => (
                  <TableRow
                    key={r.projeto_item_id}
                    className="transition-colors h-14 border-b border-slate-50 hover:bg-slate-50/80"
                  >
                    <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                      <span className="text-sm text-slate-600 line-clamp-1">
                        {r.orcamento_numero || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold whitespace-nowrap">
                        {r.produto_codigo ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900 leading-snug">
                        {r.produto}
                      </p>
                    </TableCell>
                    <TableCell className="text-right align-middle py-2">
                      <span className="text-sm text-slate-700 font-medium">
                        {r.q_entrega_futura}
                      </span>
                    </TableCell>
                    <TableCell className="text-right align-middle py-2">
                      <span className="text-sm text-slate-700 font-medium">{r.q_reserva}</span>
                    </TableCell>
                    <TableCell className="text-right align-middle py-2">
                      <span className="text-sm text-slate-700 font-medium">{r.q_entregue}</span>
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-6 text-right align-middle py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                        onClick={() => abrirDevolucao(r)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Devolver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {visibleCount < rows.length && !loading && (
            <div className="py-3 text-center text-xs text-slate-400">
              Role para carregar mais... ({rows.length - visibleCount} restantes)
            </div>
          )}
        </div>
      </div>

      <ModalDevolucaoItem
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={itemSelecionado}
        onSuccess={loadData}
      />
    </div>
  )
}
