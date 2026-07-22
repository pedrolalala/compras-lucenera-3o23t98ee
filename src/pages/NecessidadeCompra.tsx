import { useState, useEffect, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Search,
  ShoppingCart,
  X,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PackageCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { NecessidadeDetailsPanel } from '@/components/necessidade/NecessidadeDetailsPanel'
import { ModalRegistrarCompra } from '@/components/compra/ModalRegistrarCompra'
import { ModalPedidoLote } from '@/components/compra/ModalPedidoLote'
import { NecessidadeCompraDetalhe } from '@/components/compra/NecessidadeCompraDetalhe'
// SPEC-040: aba nova "Por Item de Orçamento" (Fluxo B) — componente próprio,
// não altera nada do Fluxo A abaixo.
import { NecessidadeCompraPorItemTab } from '@/components/compra/NecessidadeCompraPorItemTab'
import {
  getNecessidadeCompra,
  traduzirStatusPedidoCompra,
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH)
  const [modalOpen, setModalOpen] = useState(false)
  const [produtoParaCompra, setProdutoParaCompra] = useState<NecessidadeCompraRow | null>(null)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)

  // SPEC-030 Parte 2: filtro por marca + seleção múltipla para Pedido em Lote
  const [selectedMarca, setSelectedMarca] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loteModalOpen, setLoteModalOpen] = useState(false)

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
      setSelectedIds(new Set())
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
  }, [debouncedSearch, selectedMarca])

  const selectedProduto = useMemo(
    () => rows.find((r) => r.produto_id === selectedProdutoId) ?? null,
    [rows, selectedProdutoId],
  )

  // SPEC-030 Parte 2: marcas distintas presentes no resultado (derivado de
  // rows, sem query separada), para popular o filtro por marca.
  const marcasDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r) => {
      if (r.marca_id && r.marca_nome) map.set(r.marca_id, r.marca_nome)
    })
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rows])

  const filteredRows = useMemo(
    () => (selectedMarca === 'all' ? rows : rows.filter((r) => r.marca_id === selectedMarca)),
    [rows, selectedMarca],
  )

  const visibleRows = filteredRows.slice(0, visibleCount)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < 300 &&
      visibleCount < filteredRows.length
    ) {
      setVisibleCount((prev) => Math.min(prev + VISIBLE_BATCH, filteredRows.length))
    }
  }

  // SPEC-039 (P-04): "Pendente" passa a ser a métrica de destaque — déficit
  // ainda não coberto por pedido de compra em aberto (reflete o filtro atual
  // da lista, já que vw_necessidade_compra só traz pendente > 0).
  // "Necessidade" continua calculada e exibida como coluna informativa
  // (déficit bruto, sem descontar pedidos).
  const totalPendente = useMemo(() => rows.reduce((s, r) => s + r.pendente, 0), [rows])

  // Fornecedor comum aos itens já selecionados (todas as linhas marcadas
  // resolvem para o mesmo fornecedor_id, por construção de toggleSelect).
  const selectedFornecedorId = useMemo(() => {
    if (selectedIds.size === 0) return null
    const first = rows.find((r) => selectedIds.has(r.produto_id))
    return first?.fornecedor_id ?? null
  }, [selectedIds, rows])

  const selectedItens = useMemo(
    () => rows.filter((r) => selectedIds.has(r.produto_id)),
    [rows, selectedIds],
  )

  function toggleSelect(row: NecessidadeCompraRow) {
    if (!row.fornecedor_id) return
    const isSelected = selectedIds.has(row.produto_id)
    if (!isSelected && selectedFornecedorId && selectedFornecedorId !== row.fornecedor_id) {
      toast({
        title: 'Fornecedor diferente',
        description:
          'Este item resolve para um fornecedor diferente dos já selecionados. Desmarque os itens do outro fornecedor antes de continuar, ou feche o pedido em lote atual primeiro.',
        variant: 'destructive',
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.produto_id)) next.delete(row.produto_id)
      else next.add(row.produto_id)
      return next
    })
  }

  function toggleExpand(e: React.MouseEvent, produtoId: string) {
    e.stopPropagation()
    setExpandedId((prev) => (prev === produtoId ? null : produtoId))
  }

  return (
    <div className="flex flex-col gap-4 w-full flex-1 min-h-0 overflow-hidden px-4 md:px-6 py-3 animate-fade-in-up">
      <div className="shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Necessidade de Compra
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Déficit de estoque por item vendido/aprovado — agregado por produto ou detalhado por item
          de orçamento (L Fixo).
        </p>
      </div>

      {/* SPEC-040 (P-01): duas abas na mesma tela. "Por Produto" é o Fluxo A
          existente (SPEC-039), sem NENHUMA alteração de comportamento abaixo
          — só foi reindentado para dentro de TabsContent. "Por Item de
          Orçamento" é o Fluxo B novo (componente próprio, ver
          components/compra/NecessidadeCompraPorItemTab.tsx). */}
      <Tabs defaultValue="produto" className="flex flex-col flex-1 min-h-0 gap-4">
        <TabsList className="w-fit shrink-0">
          <TabsTrigger value="produto">Por Produto</TabsTrigger>
          <TabsTrigger value="item">Por Item de Orçamento</TabsTrigger>
        </TabsList>

        {/* Bug de layout (Radix + Tailwind): o atributo nativo `hidden` que o
            Radix usa para esconder a aba inativa tem a mesma especificidade
            CSS que a classe `.flex` do Tailwind, que carrega depois no
            cascade e vence o empate — então a aba inativa continha
            `display:flex` mesmo escondida, dividindo a altura ao meio com a
            aba ativa. Fix: `flex flex-col` (que fazem o TabsContent virar
            container) saem daqui e vão para uma div interna; o que fica no
            TabsContent (`flex-1 min-h-0`) não mexe em `display`, então não
            conflita com `[hidden]`. */}
        <TabsContent value="produto" className="flex-1 min-h-0 mt-0">
          <div className="flex flex-col h-full min-h-0 gap-4">
            <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4 shrink-0">
              <div className="flex gap-2 w-full sm:w-auto">
                {selectedIds.size > 0 && (
                  <Button
                    onClick={() => setLoteModalOpen(true)}
                    className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <PackageCheck className="w-4 h-4 mr-2" />
                    Fechar pedido em lote ({selectedIds.size})
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
                <SummaryCard label="Produtos com necessidade" value={rows.length} color="amber" />
                <SummaryCard label="Total unidades pendentes" value={totalPendente} color="red" />
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
                  <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                    <SelectTrigger className="w-full sm:w-[220px] h-9 bg-slate-50 border-slate-200 text-sm">
                      <SelectValue placeholder="Todas as marcas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as marcas</SelectItem>
                      {marcasDisponiveis.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
                  <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
                    {loading
                      ? progress
                        ? `Carregando... ${progress.loaded} de ${progress.total} produtos`
                        : 'Carregando...'
                      : `${visibleRows.length} de ${filteredRows.length} produto(s) com necessidade`}
                  </div>
                  <div className="overflow-auto flex-1" onScroll={handleScroll}>
                    <Table className="min-w-[1750px] w-full table-fixed">
                      <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <TableRow className="h-11">
                          <TableHead className="w-[40px] pl-4 sm:pl-6 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            <span className="sr-only">Selecionar</span>
                          </TableHead>
                          <TableHead className="w-[100px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Código
                          </TableHead>
                          <TableHead className="w-[220px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Produto
                          </TableHead>
                          <TableHead className="w-[120px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Marca
                          </TableHead>
                          <TableHead className="w-[150px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Fornecedor
                          </TableHead>
                          <TableHead className="w-[90px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Física
                          </TableHead>
                          <TableHead className="w-[110px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Comprometida
                          </TableHead>
                          <TableHead className="w-[100px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Disponível
                          </TableHead>
                          <TableHead className="w-[110px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Necessidade
                          </TableHead>
                          <TableHead className="w-[100px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Pendente
                          </TableHead>
                          <TableHead className="w-[160px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Empresa que comprou
                          </TableHead>
                          <TableHead className="w-[130px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Status do pedido
                          </TableHead>
                          <TableHead className="w-[130px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Entrega prevista
                          </TableHead>
                          <TableHead className="w-[90px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Projetos
                          </TableHead>
                          <TableHead className="w-[100px] pr-4 sm:pr-6 text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                            Compra
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={15} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-slate-500">Carregando...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : visibleRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={15} className="h-40 text-center">
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
                          visibleRows.flatMap((r, idx) => {
                            const isExpanded = expandedId === r.produto_id
                            const detailRow = isExpanded ? (
                              <TableRow
                                key={`${r.produto_id}-detalhe`}
                                className="hover:bg-transparent"
                              >
                                <TableCell colSpan={15} className="p-0">
                                  <NecessidadeCompraDetalhe produtoId={r.produto_id} />
                                </TableCell>
                              </TableRow>
                            ) : null
                            return [
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
                                <TableCell
                                  className="pl-4 sm:pl-6 align-middle py-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={selectedIds.has(r.produto_id)}
                                    disabled={!r.fornecedor_id}
                                    onCheckedChange={() => toggleSelect(r)}
                                    title={
                                      r.fornecedor_id
                                        ? undefined
                                        : 'Sem fornecedor resolvido (produto/marca sem fornecedor cadastrado) — fora do Pedido em Lote'
                                    }
                                  />
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
                                    {r.marca_nome || '-'}
                                  </span>
                                </TableCell>
                                <TableCell className="align-middle py-2">
                                  <span className="text-sm text-slate-600 line-clamp-1">
                                    {r.fornecedor_nome || '-'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right align-middle py-2">
                                  <span className="text-sm text-slate-600">{r.qtd_fisica}</span>
                                </TableCell>
                                <TableCell className="text-right align-middle py-2">
                                  <span className="text-sm text-amber-700 font-medium">
                                    {r.qtd_comprometida}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right align-middle py-2">
                                  <span
                                    className={cn(
                                      'text-sm',
                                      r.qtd_disponivel < 0
                                        ? 'text-red-600 font-semibold'
                                        : 'text-slate-600',
                                    )}
                                  >
                                    {r.qtd_disponivel}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right align-middle py-2">
                                  <span className="text-sm text-slate-500">
                                    {r.necessidade_compra}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right align-middle py-2">
                                  <span className="inline-flex items-center gap-1 justify-end">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    <span className="font-bold text-red-600 text-sm">
                                      {r.pendente}
                                    </span>
                                  </span>
                                </TableCell>
                                <TableCell className="align-middle py-2">
                                  <span className="text-sm text-slate-600 line-clamp-1">
                                    {r.qtd_pedidos_abertos === 0
                                      ? '-'
                                      : r.qtd_pedidos_abertos === 1
                                        ? '1 pedido'
                                        : `${r.qtd_pedidos_abertos} pedidos`}
                                  </span>
                                </TableCell>
                                <TableCell className="align-middle py-2">
                                  <span className="text-sm text-slate-600 line-clamp-1">
                                    {r.status_mais_critico
                                      ? traduzirStatusPedidoCompra(r.status_mais_critico)
                                      : '-'}
                                  </span>
                                </TableCell>
                                <TableCell className="align-middle py-2">
                                  <span className="text-sm text-slate-600">
                                    {r.proxima_data_prevista_entrega
                                      ? new Date(
                                          r.proxima_data_prevista_entrega,
                                        ).toLocaleDateString('pt-BR')
                                      : '-'}
                                  </span>
                                </TableCell>
                                <TableCell
                                  className="text-right align-middle py-2"
                                  onClick={(e) => toggleExpand(e, r.produto_id)}
                                >
                                  {r.projetos_com_entrega_futura > 0 ? (
                                    <button
                                      className={cn(
                                        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors',
                                        isExpanded
                                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                          : 'bg-red-50 text-red-600 hover:bg-red-100',
                                      )}
                                      title={isExpanded ? 'Fechar detalhes' : 'Ver projetos'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 shrink-0" />
                                      )}
                                      {r.projetos_com_entrega_futura}
                                    </button>
                                  ) : (
                                    <span className="text-sm text-slate-400">
                                      {r.projetos_com_entrega_futura}
                                    </span>
                                  )}
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
                              </TableRow>,
                              ...(detailRow ? [detailRow] : []),
                            ]
                          })
                        )}
                      </TableBody>
                    </Table>
                    {visibleCount < filteredRows.length && !loading && (
                      <div className="py-3 text-center text-xs text-slate-400">
                        Role para carregar mais... ({filteredRows.length - visibleCount} restantes)
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

            <ModalPedidoLote
              open={loteModalOpen}
              onOpenChange={setLoteModalOpen}
              itens={selectedItens}
              fornecedorId={selectedFornecedorId ?? ''}
              fornecedorNome={selectedItens[0]?.fornecedor_nome ?? ''}
              onSuccess={() => {
                setLoteModalOpen(false)
                loadData()
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="item" className="flex-1 min-h-0 mt-0">
          <div className="flex flex-col h-full min-h-0">
            <NecessidadeCompraPorItemTab />
          </div>
        </TabsContent>
      </Tabs>
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
