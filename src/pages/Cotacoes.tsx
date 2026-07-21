import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import { Search, X, RefreshCw, AlertTriangle, Pencil, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getNecessidadeCompra,
  type NecessidadeCompraRow,
  type ProgressInfo,
} from '@/services/necessidade-compra'
import { atualizarPrecoCusto, atualizarDescontoCompra } from '@/services/cotacoes'

const VISIBLE_BATCH = 100

function fmtBRL(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtQtd(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

interface PrecoEditState {
  produtoId: string
  valor: string
  saving: boolean
}

// SPEC-038 Item 5: edição inline de % desconto de compra, mesmo padrão de
// PrecoEditState — estado separado porque as duas edições (preço e desconto)
// não devem abrir ao mesmo tempo na mesma linha.
interface DescontoEditState {
  produtoId: string
  valor: string
  saving: boolean
}

export default function Cotacoes() {
  const { toast } = useToast()

  const [rows, setRows] = useState<NecessidadeCompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [editando, setEditando] = useState<PrecoEditState | null>(null)
  const [editandoDesconto, setEditandoDesconto] = useState<DescontoEditState | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const descontoInputRef = useRef<HTMLInputElement>(null)

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
      toast({ title: 'Erro', description: 'Falha ao carregar cotações.', variant: 'destructive' })
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

  useEffect(() => {
    if (editando) inputRef.current?.focus()
  }, [editando?.produtoId])

  useEffect(() => {
    if (editandoDesconto) descontoInputRef.current?.focus()
  }, [editandoDesconto?.produtoId])

  function iniciarEdicao(row: NecessidadeCompraRow) {
    setEditando({
      produtoId: row.produto_id,
      valor: row.preco_custo != null ? String(row.preco_custo) : '',
      saving: false,
    })
  }

  function iniciarEdicaoDesconto(row: NecessidadeCompraRow) {
    setEditandoDesconto({
      produtoId: row.produto_id,
      valor: row.percentual_desconto_compra != null ? String(row.percentual_desconto_compra) : '',
      saving: false,
    })
  }

  async function salvarPreco(produtoId: string) {
    if (!editando || editando.produtoId !== produtoId) return
    const preco = parseFloat(editando.valor.replace(',', '.'))
    if (isNaN(preco) || preco < 0) {
      toast({
        title: 'Valor inválido',
        description: 'Digite um preço >= 0.',
        variant: 'destructive',
      })
      return
    }
    setEditando((e) => (e ? { ...e, saving: true } : null))
    try {
      await atualizarPrecoCusto(produtoId, preco)
      setRows((prev) =>
        prev.map((r) => (r.produto_id === produtoId ? { ...r, preco_custo: preco } : r)),
      )
      toast({ title: 'Preço atualizado', description: `R$ ${preco.toFixed(2).replace('.', ',')}` })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setEditando(null)
    }
  }

  function cancelarEdicao() {
    setEditando(null)
  }

  async function salvarDesconto(produtoId: string) {
    if (!editandoDesconto || editandoDesconto.produtoId !== produtoId) return
    const desconto = parseFloat(editandoDesconto.valor.replace(',', '.'))
    if (isNaN(desconto) || desconto < 0 || desconto > 100) {
      toast({
        title: 'Valor inválido',
        description: 'Digite um percentual entre 0 e 100.',
        variant: 'destructive',
      })
      return
    }
    setEditandoDesconto((e) => (e ? { ...e, saving: true } : null))
    try {
      await atualizarDescontoCompra(produtoId, desconto)
      setRows((prev) =>
        prev.map((r) =>
          r.produto_id === produtoId ? { ...r, percentual_desconto_compra: desconto } : r,
        ),
      )
      toast({ title: 'Desconto atualizado', description: `${desconto.toFixed(2)}%` })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setEditandoDesconto(null)
    }
  }

  function cancelarEdicaoDesconto() {
    setEditandoDesconto(null)
  }

  const visibleRows = rows.slice(0, visibleCount)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && visibleCount < rows.length)
      setVisibleCount((prev) => Math.min(prev + VISIBLE_BATCH, rows.length))
  }

  const totals = useMemo(() => {
    const comPreco = rows.filter((r) => r.preco_custo != null && r.preco_custo > 0)
    const semPreco = rows.filter((r) => !r.preco_custo || r.preco_custo === 0).length
    const custoEstimado = comPreco.reduce((s, r) => s + r.necessidade_compra * r.preco_custo!, 0)
    const totalNecessidade = rows.reduce((s, r) => s + r.necessidade_compra, 0)
    return { produtos: rows.length, totalNecessidade, custoEstimado, semPreco }
  }, [rows])

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 xl:h-[calc(100vh-130px)] animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Cotações</h1>
          <p className="text-slate-500 text-sm mt-1">
            Produtos com déficit de estoque — edite o preço de compra para estimar o custo total.
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
          <SCard
            label="Produtos com déficit"
            value={totals.produtos.toLocaleString('pt-BR')}
            color="amber"
          />
          <SCard
            label="Total unidades a comprar"
            value={fmtQtd(totals.totalNecessidade)}
            color="red"
          />
          <SCard
            label="Custo estimado total"
            value={fmtBRL(totals.custoEstimado)}
            color="emerald"
          />
          <SCard
            label="Sem preço cadastrado"
            value={totals.semPreco.toLocaleString('pt-BR')}
            color="slate"
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
          <div className="relative flex-1">
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
              <X className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
          {loading
            ? progress
              ? `Carregando... ${progress.loaded} de ${progress.total}`
              : 'Carregando...'
            : `${visibleRows.length} de ${rows.length} produto(s) com déficit`}
        </div>

        <div className="overflow-auto flex-1" onScroll={handleScroll}>
          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="pl-4 sm:pl-6 w-[9%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Cód.
                </TableHead>
                <TableHead className="text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Produto
                </TableHead>
                <TableHead className="hidden lg:table-cell w-[10%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Qtd. Física
                </TableHead>
                <TableHead className="hidden md:table-cell w-[10%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Reservada
                </TableHead>
                <TableHead className="w-[12%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  <span className="text-red-600">Déficit</span>
                </TableHead>
                <TableHead className="w-[13%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Preço Compra
                </TableHead>
                <TableHead className="w-[10%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  % Desconto
                </TableHead>
                <TableHead className="pr-4 sm:pr-6 w-[13%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Custo Estimado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
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
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <AlertTriangle className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">
                        {searchInput
                          ? 'Nenhum produto encontrado'
                          : 'Nenhum déficit de estoque no momento'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r, idx) => {
                  const isEditing = editando?.produtoId === r.produto_id
                  const isEditingDesconto = editandoDesconto?.produtoId === r.produto_id
                  const custoEstimado =
                    r.preco_custo && r.preco_custo > 0 ? r.necessidade_compra * r.preco_custo : null

                  return (
                    <TableRow
                      key={`${r.produto_id}-${idx}`}
                      className="h-14 border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
                    >
                      <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold whitespace-nowrap">
                          {r.produto_codigo || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <p className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">
                          {r.produto}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right align-middle py-2">
                        <span className="text-sm text-slate-500 tabular-nums">
                          {fmtQtd(r.qtd_fisica)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right align-middle py-2">
                        <span className="text-sm text-amber-700 tabular-nums">
                          {fmtQtd(r.qtd_comprometida)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-middle py-2">
                        <span className="inline-flex items-center gap-1 justify-end">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="font-bold text-red-600 text-sm tabular-nums">
                            {fmtQtd(r.necessidade_compra)}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-right align-middle py-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isEditing) iniciarEdicao(r)
                        }}
                      >
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              ref={inputRef}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editando!.valor}
                              onChange={(e) =>
                                setEditando((prev) =>
                                  prev ? { ...prev, valor: e.target.value } : null,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') salvarPreco(r.produto_id)
                                if (e.key === 'Escape') cancelarEdicao()
                              }}
                              onBlur={() => salvarPreco(r.produto_id)}
                              className="h-7 w-24 text-xs text-right px-2"
                              disabled={editando!.saving}
                            />
                            {editando!.saving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
                            ) : (
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  salvarPreco(r.produto_id)
                                }}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 group cursor-pointer">
                            <span
                              className={cn(
                                'text-sm tabular-nums',
                                r.preco_custo ? 'text-slate-700' : 'text-slate-400 italic',
                              )}
                            >
                              {r.preco_custo ? fmtBRL(r.preco_custo) : 'Clique p/ editar'}
                            </span>
                            <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right align-middle py-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isEditingDesconto) iniciarEdicaoDesconto(r)
                        }}
                      >
                        {isEditingDesconto ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              ref={descontoInputRef}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={editandoDesconto!.valor}
                              onChange={(e) =>
                                setEditandoDesconto((prev) =>
                                  prev ? { ...prev, valor: e.target.value } : null,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') salvarDesconto(r.produto_id)
                                if (e.key === 'Escape') cancelarEdicaoDesconto()
                              }}
                              onBlur={() => salvarDesconto(r.produto_id)}
                              className="h-7 w-20 text-xs text-right px-2"
                              disabled={editandoDesconto!.saving}
                            />
                            {editandoDesconto!.saving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
                            ) : (
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  salvarDesconto(r.produto_id)
                                }}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 group cursor-pointer">
                            <span
                              className={cn(
                                'text-sm tabular-nums',
                                r.percentual_desconto_compra
                                  ? 'text-slate-700'
                                  : 'text-slate-400 italic',
                              )}
                            >
                              {r.percentual_desconto_compra
                                ? `${r.percentual_desconto_compra.toFixed(2)}%`
                                : 'Clique p/ editar'}
                            </span>
                            <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-6 text-right align-middle py-2">
                        <span
                          className={cn(
                            'text-sm tabular-nums',
                            custoEstimado ? 'font-semibold text-emerald-700' : 'text-slate-300',
                          )}
                        >
                          {custoEstimado ? fmtBRL(custoEstimado) : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
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

function SCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'amber' | 'red' | 'emerald' | 'slate'
}) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-2 flex items-center gap-3', colorMap[color])}>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium opacity-80 max-w-[110px] leading-tight">{label}</p>
    </div>
  )
}
