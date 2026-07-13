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
import { Search, X, RefreshCw, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getEstoqueProdutos, type EstoqueProdutoRow, type ProgressInfo } from '@/services/estoque-produtos'

const VISIBLE_BATCH = 100

function fmt(n: number | null | undefined, decimals = 3) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtBRL(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function estoqueColor(disponivel: number) {
  if (disponivel > 0) return 'text-emerald-700 font-semibold'
  return 'text-red-600 font-semibold'
}

export default function EstoqueProdutos() {
  const { toast } = useToast()

  const [rows, setRows] = useState<EstoqueProdutoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    setProgress(null)
    try {
      const data = await getEstoqueProdutos(debouncedSearch || undefined, (info) => {
        setProgress(info)
      })
      setRows(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar estoque de produtos.',
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && visibleCount < rows.length) {
      setVisibleCount((prev) => Math.min(prev + VISIBLE_BATCH, rows.length))
    }
  }

  const totals = useMemo(() => ({
    produtos: rows.length,
    estoqueTotal: rows.reduce((s, r) => s + r.estoque_total, 0),
    custoTotal: rows.reduce((s, r) => s + r.custo_total, 0),
    semEstoque: rows.filter((r) => r.estoque_disponivel <= 0).length,
  }), [rows])

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 xl:h-[calc(100vh-130px)] animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Estoque de Produtos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Todos os produtos ativos com saldo de estoque atual.
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
        <div className="flex flex-wrap gap-3 shrink-0">
          <SummaryCard label="Total produtos" value={totals.produtos.toLocaleString('pt-BR')} color="slate" />
          <SummaryCard label="Unidades em estoque" value={fmt(totals.estoqueTotal, 0)} color="blue" />
          <SummaryCard label="Custo total estoque" value={fmtBRL(totals.custoTotal)} color="emerald" />
          <SummaryCard label="Sem estoque disponível" value={totals.semEstoque.toLocaleString('pt-BR')} color="red" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, código, SKU, referência ou marca..."
              className="pl-9 bg-slate-50 border-slate-200 h-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchInput(''); setDebouncedSearch('') }}
              className="shrink-0 text-slate-500 hover:text-slate-700 h-9"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
          {loading
            ? progress
              ? `Carregando... ${progress.loaded} de ${progress.total} produtos`
              : 'Carregando...'
            : `${visibleRows.length} de ${rows.length} produto(s)`}
        </div>

        <div className="overflow-auto flex-1" onScroll={handleScroll}>
          <Table className="w-full">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="pl-4 sm:pl-6 text-slate-600 font-semibold text-xs uppercase tracking-wide w-[8%]">Cód.</TableHead>
                <TableHead className="text-slate-600 font-semibold text-xs uppercase tracking-wide">Produto</TableHead>
                <TableHead className="hidden md:table-cell text-slate-600 font-semibold text-xs uppercase tracking-wide w-[11%]">Marca</TableHead>
                <TableHead className="hidden xl:table-cell text-slate-600 font-semibold text-xs uppercase tracking-wide w-[9%]">Categoria</TableHead>
                <TableHead className="hidden sm:table-cell text-slate-600 font-semibold text-xs uppercase tracking-wide w-[5%] text-center">Un.</TableHead>
                <TableHead className="text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[9%]">Qtd. Estoque</TableHead>
                <TableHead className="hidden lg:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[8%]">Reservada</TableHead>
                <TableHead className="hidden lg:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[8%]">Disponível</TableHead>
                <TableHead className="hidden xl:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[8%]">Showroom</TableHead>
                <TableHead className="hidden xl:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[8%]">Total</TableHead>
                <TableHead className="hidden 2xl:table-cell text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[9%]">Custo unit.</TableHead>
                <TableHead className="pr-4 sm:pr-6 text-right text-slate-600 font-semibold text-xs uppercase tracking-wide w-[9%]">Preço venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500">
                        {progress ? `${progress.loaded} de ${progress.total}...` : 'Carregando...'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-40 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <Package className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">
                        {searchInput ? 'Nenhum produto encontrado' : 'Nenhum produto ativo no momento'}
                      </p>
                      {searchInput && (
                        <p className="text-sm mt-1">Tente ajustar a busca.</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r, idx) => (
                  <TableRow
                    key={`${r.produto_id}-${idx}`}
                    className="h-12 border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
                  >
                    <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold whitespace-nowrap">
                        {r.produto_codigo || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle py-2">
                      <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">
                        {r.produto}
                      </p>
                      {r.sku && (
                        <p className="text-xs text-slate-400 mt-0.5">SKU: {r.sku}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell align-middle py-2">
                      <span className="text-sm text-slate-600">{r.marca || '—'}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell align-middle py-2">
                      <span className="text-xs text-slate-500">{r.categoria || '—'}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-center align-middle py-2">
                      <span className="text-xs text-slate-500">{r.unidade || 'UN'}</span>
                    </TableCell>
                    <TableCell className="text-right align-middle py-2">
                      <span className={cn('text-sm tabular-nums', estoqueColor(r.qtd_estoque_itens))}>
                        {fmt(r.qtd_estoque_itens)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right align-middle py-2">
                      <span className="text-sm text-amber-700 tabular-nums">{fmt(r.qtd_reservada)}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right align-middle py-2">
                      <span className={cn('text-sm tabular-nums', estoqueColor(r.estoque_disponivel))}>
                        {fmt(r.estoque_disponivel)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right align-middle py-2">
                      <span className="text-sm text-slate-600 tabular-nums">{fmt(r.estoque_showroom, 0)}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right align-middle py-2">
                      <span className="text-sm text-slate-700 tabular-nums">{fmt(r.estoque_total)}</span>
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell text-right align-middle py-2">
                      <span className="text-sm text-slate-600 tabular-nums">{fmtBRL(r.preco_custo)}</span>
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-6 text-right align-middle py-2">
                      <span className="text-sm font-medium text-slate-800 tabular-nums">{fmtBRL(r.preco_venda)}</span>
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
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'slate' | 'blue' | 'emerald' | 'red'
}) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-2 flex items-center gap-3', colorMap[color])}>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium opacity-80 max-w-[100px] leading-tight">{label}</p>
    </div>
  )
}
