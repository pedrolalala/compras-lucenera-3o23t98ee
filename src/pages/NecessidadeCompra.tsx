import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { Search, ShoppingCart, X, RefreshCw, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { NecessidadeDetailsPanel } from '@/components/necessidade/NecessidadeDetailsPanel'
import { ModalRegistrarCompra } from '@/components/compra/ModalRegistrarCompra'
import {
  getNecessidadeCompra,
  type NecessidadeCompraRow,
  type ProgressInfo,
} from '@/services/necessidade-compra'

const VISIBLE_BATCH = 100

export default function NecessidadeCompra() {
  const { toast } = useToast()

  const [rows, setRows] = useState<NecessidadeCompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [modalOpen, setModalOpen] = useState(false)
  const [produtoParaCompra, setProdutoParaCompra] = useState<NecessidadeCompraRow | null>(null)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    setProgress(null)
    try {
      const data = await getNecessidadeCompra(debouncedSearch || undefined, (info) => {
        setProgress(info)
      })
      setRows(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar necessidade de compra.',
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

  const selectedProduto = useMemo(
    () => rows.find((r) => r.produto_id === selectedProdutoId) ?? null,
    [rows, selectedProdutoId],
  )

  const visibleRows = rows.slice(0, visibleCount)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && visibleCount < rows.length) {
      setVisibleCount((prev) => Math.min(prev + VISIBLE_BATCH, rows.length))
    }
  }

  const totalNecessidade = useMemo(() => rows.reduce((s, r) => s + r.necessidade_compra, 0), [rows])

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 lg:pb-0 xl:h-[calc(100vh-130px)] animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Necessidade de Compra
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Produtos com entrega futura pendente — déficit de estoque por item vendido/aprovado.
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

      {!loading && rows.length > 0 && (
        <div className="flex gap-3 shrink-0">
          <SummaryCard label="Produtos com necessidade" value={rows.length} color="amber" />
          <SummaryCard label="Total unidades a comprar" value={totalNecessidade} color="red" />
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
        <div className="w-full xl:flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
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
                  ? `Carregando... ${progress.loaded} de ${progress.total} produtos`
                  : 'Carregando...'
                : `${visibleRows.length} de ${rows.length} produto(s) com necessidade`}
            </div>
            <div className="overflow-auto flex-1" onScroll={handleScroll}>
              <Table className="w-full table-fixed">
                <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <TableRow className="h-11">
                    <TableHead className="w-[18%] pl-4 sm:pl-6 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Código
                    </TableHead>
                    <TableHead className="text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Produto
                    </TableHead>
                    <TableHead className="w-[11%] hidden lg:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Física
                    </TableHead>
                    <TableHead className="w-[13%] hidden xl:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Comprometida
                    </TableHead>
                    <TableHead className="w-[14%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Necessidade
                    </TableHead>
                    <TableHead className="w-[10%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Projetos
                    </TableHead>
                    <TableHead className="w-[10%] pr-4 sm:pr-6 text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                      Compra
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
                              ? 'Nenhum produto encontrado'
                              : 'Nenhuma necessidade de compra no momento'}
                          </p>
                          <p className="text-sm mt-1">
                            {searchInput
                              ? 'Tente ajustar a busca.'
                              : 'Todos os itens vendidos têm cobertura de estoque.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map((r, idx) => (
                      <TableRow
                        key={`${r.produto_id}-${idx}`}
                        onClick={() => setSelectedProdutoId(r.produto_id)}
                        className={cn(
                          'cursor-pointer transition-colors h-14 border-b border-slate-50',
                          selectedProdutoId === r.produto_id
                            ? 'bg-primary/5 hover:bg-primary/10'
                            : 'hover:bg-slate-50/80',
                        )}
                      >
                        <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold whitespace-nowrap">
                            {r.produto_codigo || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="align-middle py-2">
                          <p className="line-clamp-2 text-sm font-medium text-slate-900 leading-snug">
                            {r.produto}
                          </p>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right align-middle py-2">
                          <span className="text-sm text-slate-600">{r.qtd_fisica}</span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-right align-middle py-2">
                          <span className="text-sm text-amber-700 font-medium">
                            {r.qtd_comprometida}
                          </span>
                        </TableCell>
                        <TableCell className="text-right align-middle py-2">
                          <span className="inline-flex items-center gap-1 justify-end">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="font-bold text-red-600 text-sm">
                              {r.necessidade_compra}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right align-middle py-2">
                          <span className="text-sm text-slate-500">
                            {r.projetos_com_entrega_futura}
                          </span>
                        </TableCell>
                        <TableCell
                          className="pr-4 sm:pr-6 text-right align-middle py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => {
                              setProdutoParaCompra(r)
                              setModalOpen(true)
                            }}
                          >
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                            Comprar
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
        </div>

        <div className="w-full xl:w-80 shrink-0 flex flex-col xl:overflow-hidden xl:h-full">
          <NecessidadeDetailsPanel produto={selectedProduto} />
        </div>
      </div>

      <ModalRegistrarCompra
        open={modalOpen}
        onOpenChange={setModalOpen}
        produto={produtoParaCompra}
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
