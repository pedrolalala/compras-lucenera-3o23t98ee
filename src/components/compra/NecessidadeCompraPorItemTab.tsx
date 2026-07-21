import { useState, useEffect, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, ShoppingCart, X, RefreshCw, AlertTriangle, PackageCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ModalGerarCompraItemOrcamento } from '@/components/compra/ModalGerarCompraItemOrcamento'
import {
  getNecessidadeCompraPorItem,
  type NecessidadeCompraItemRow,
  type ProgressInfo,
} from '@/services/necessidade-compra-item'

// SPEC-040 — Fluxo B ("Por Item de Orçamento"). Segue o mesmo padrão visual
// e de estado do Fluxo A (NecessidadeCompra.tsx, não alterado), mas a
// seleção é por projeto_item_id (chave granular real), não produto_id.

const VISIBLE_BATCH = 100

export function NecessidadeCompraPorItemTab() {
  const { toast } = useToast()

  const [rows, setRows] = useState<NecessidadeCompraItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    setProgress(null)
    try {
      const data = await getNecessidadeCompraPorItem(debouncedSearch || undefined, (info) => {
        setProgress(info)
      })
      setRows(data)
      setSelectedIds(new Set())
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar necessidade de compra por item de orçamento.',
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

  const totalPendente = useMemo(() => rows.reduce((s, r) => s + r.pendente_item, 0), [rows])

  // P-02: fornecedor comum às linhas já selecionadas — mesma trava do
  // toggleSelect do Fluxo A (NecessidadeCompra.tsx).
  const selectedFornecedorId = useMemo(() => {
    if (selectedIds.size === 0) return null
    const first = rows.find((r) => selectedIds.has(r.projeto_item_id))
    return first?.fornecedor_id ?? null
  }, [selectedIds, rows])

  const selectedItens = useMemo(
    () => rows.filter((r) => selectedIds.has(r.projeto_item_id)),
    [rows, selectedIds],
  )

  function toggleSelect(row: NecessidadeCompraItemRow) {
    if (!row.fornecedor_id) return
    const isSelected = selectedIds.has(row.projeto_item_id)
    if (!isSelected && selectedFornecedorId && selectedFornecedorId !== row.fornecedor_id) {
      toast({
        title: 'Fornecedor diferente',
        description:
          'Este item resolve para um fornecedor diferente dos já selecionados. Desmarque os itens do outro fornecedor antes de continuar, ou gere a compra do lote atual primeiro.',
        variant: 'destructive',
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.projeto_item_id)) next.delete(row.projeto_item_id)
      else next.add(row.projeto_item_id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <p className="text-slate-500 text-sm">
          Itens de orçamento aprovado com entrega futura pendente, por posição específica (L Fixo) —
          não agrega o mesmo produto entre orçamentos ou posições diferentes.
        </p>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          {selectedIds.size > 0 && (
            <Button
              onClick={() => setModalOpen(true)}
              className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PackageCheck className="w-4 h-4 mr-2" />
              Gerar Compra ({selectedIds.size})
            </Button>
          )}
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
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex gap-3 shrink-0">
          <SummaryCard
            label="Itens de orçamento com necessidade"
            value={rows.length}
            color="amber"
          />
          <SummaryCard label="Total unidades pendentes" value={totalPendente} color="red" />
        </div>
      )}

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
            : `${visibleRows.length} de ${rows.length} item(ns) de orçamento com necessidade`}
        </div>
        <div className="overflow-auto flex-1" onScroll={handleScroll}>
          <Table className="min-w-[1100px] w-full table-fixed">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="w-[40px] pl-4 sm:pl-6 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  <span className="sr-only">Selecionar</span>
                </TableHead>
                <TableHead className="w-[130px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Orçamento
                </TableHead>
                <TableHead className="w-[100px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  L Fixo
                </TableHead>
                <TableHead className="w-[100px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Código
                </TableHead>
                <TableHead className="w-[260px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Produto
                </TableHead>
                <TableHead className="w-[170px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Fornecedor
                </TableHead>
                <TableHead className="w-[100px] pr-4 sm:pr-6 text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Pendente
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
                      <ShoppingCart className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">
                        {searchInput
                          ? 'Nenhum item encontrado'
                          : 'Nenhuma necessidade de compra por item de orçamento no momento'}
                      </p>
                      <p className="text-sm mt-1">
                        {searchInput
                          ? 'Tente ajustar a busca.'
                          : 'Todos os itens de orçamento aprovado têm cobertura de estoque ou de pedido em aberto.'}
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
                      <Checkbox
                        checked={selectedIds.has(r.projeto_item_id)}
                        disabled={!r.fornecedor_id}
                        onCheckedChange={() => toggleSelect(r)}
                        title={
                          r.fornecedor_id
                            ? undefined
                            : 'Sem fornecedor resolvido (produto/marca sem fornecedor cadastrado) — fora da geração de compra'
                        }
                      />
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <span className="text-sm text-slate-600 line-clamp-1">
                        {r.orcamento_numero || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <span className="text-sm text-slate-600">{r.l_fixo || '—'}</span>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold whitespace-nowrap">
                        {r.produto_codigo || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900 leading-snug">
                        {r.produto}
                      </p>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <span className="text-sm text-slate-600 line-clamp-1">
                        {r.fornecedor_nome || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-6 text-right align-middle py-2">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="font-bold text-red-600 text-sm">{r.pendente_item}</span>
                      </span>
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

      <ModalGerarCompraItemOrcamento
        open={modalOpen}
        onOpenChange={setModalOpen}
        itens={selectedItens}
        fornecedorId={selectedFornecedorId ?? ''}
        fornecedorNome={selectedItens[0]?.fornecedor_nome ?? ''}
        onSuccess={() => {
          setModalOpen(false)
          loadData()
        }}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'amber' | 'red'
}) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-2 flex items-center gap-3', colorMap[color])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80 max-w-[100px] leading-tight">{label}</p>
    </div>
  )
}
