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
import {
  Search,
  ShoppingCart,
  X,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { NecessidadeDetailsPanel } from '@/components/necessidade/NecessidadeDetailsPanel'
import { ModalRegistrarCompra } from '@/components/compra/ModalRegistrarCompra'
import { ModalGerarCompraItemOrcamento } from '@/components/compra/ModalGerarCompraItemOrcamento'
import { NecessidadeCompraDetalhe } from '@/components/compra/NecessidadeCompraDetalhe'
import {
  getNecessidadeCompra,
  type NecessidadeCompraRow,
  type ProgressInfo,
} from '@/services/necessidade-compra'
import {
  getNecessidadeCompraItensTodos,
  linhaDoL,
  type LinhaCarrinho,
  type NecessidadeCompraItemRow,
} from '@/services/necessidade-compra-item'

const VISIBLE_BATCH = 100

// Reuniao 04/08/2026 (Filippo + Debora): arredonda para 3 casas decimais
// antes de exibir, para nao propagar artefatos de ponto flutuante (ex:
// "5906,9999...") que a Debora encontrou em teste ao vivo. Nao foi possivel
// reproduzir o valor exato com os dados atuais do banco (todas as colunas
// de quantidade sao `numeric`, sem drift visivel), mas o arredondamento
// defensivo cobre a classe do problema independente da origem exata.
function formatQty(n: number): string {
  if (n == null || Number.isNaN(n)) return '0'
  const rounded = Math.round(n * 1000) / 1000
  return rounded.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

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

  // SPEC-030 Parte 2: filtro por marca
  const [selectedMarca, setSelectedMarca] = useState<string>('all')
  // SPEC-209 A1/A2/A6: pedido em montagem ("carrinho") — L de vários produtos e vendas, ou o
  // produto inteiro quando não tem L. Não se perde ao abrir/fechar produtos. Um fornecedor só.
  const [carrinho, setCarrinho] = useState<Record<string, LinhaCarrinho>>({})
  const [fecharPedidoOpen, setFecharPedidoOpen] = useState(false)
  // SPEC-209 A3: L com saldo a comprar (com a empresa da venda) e filtro de empresa
  const [itensOrc, setItensOrc] = useState<NecessidadeCompraItemRow[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('all')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    setProgress(null)
    try {
      const [data, itens] = await Promise.all([
        getNecessidadeCompra(debouncedSearch || undefined, (info) => {
          setProgress(info)
        }),
        getNecessidadeCompraItensTodos(),
      ])
      setRows(data)
      setItensOrc(itens)
      // tira do carrinho o L que não tem mais saldo (comprado em outro lugar)
      const pendentes = new Set(itens.map((i) => i.projeto_item_id))
      setCarrinho((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([, l]) => !l.projeto_item_id || pendentes.has(l.projeto_item_id),
          ),
        ),
      )
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
  }, [debouncedSearch, selectedMarca, selectedEmpresa])

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

  // SPEC-209 A3: empresas das vendas com L a comprar e, por produto, de quais empresas são os L.
  const empresasDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    itensOrc.forEach((i) => {
      if (i.empresa_id) map.set(i.empresa_id, i.empresa_nome ?? '—')
    })
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [itensOrc])

  const itensPorProduto = useMemo(() => {
    const map = new Map<string, NecessidadeCompraItemRow[]>()
    itensOrc.forEach((i) => {
      const lista = map.get(i.produto_id) ?? []
      lista.push(i)
      map.set(i.produto_id, lista)
    })
    return map
  }, [itensOrc])

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (selectedMarca === 'all' || r.marca_id === selectedMarca) &&
          (selectedEmpresa === 'all' ||
            (itensPorProduto.get(r.produto_id) ?? []).some((i) => i.empresa_id === selectedEmpresa)),
      ),
    [rows, selectedMarca, selectedEmpresa, itensPorProduto],
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

  // SPEC-209 A: linhas do pedido em montagem
  const linhasCarrinho = useMemo(() => Object.values(carrinho), [carrinho])
  const fornecedorCarrinho = linhasCarrinho[0]
    ? { id: linhasCarrinho[0].fornecedor_id, nome: linhasCarrinho[0].fornecedor_nome }
    : null
  const lsNoCarrinho = useMemo(
    () => new Set(linhasCarrinho.map((l) => l.projeto_item_id).filter(Boolean) as string[]),
    [linhasCarrinho],
  )
  const produtosNoCarrinho = useMemo(
    () => new Set(linhasCarrinho.map((l) => l.produto_id)),
    [linhasCarrinho],
  )

  function fornecedorConfere(fornecedorId: string | null) {
    if (!fornecedorId) return false
    if (fornecedorCarrinho && fornecedorCarrinho.id !== fornecedorId) {
      toast({
        title: 'Fornecedor diferente',
        description: `O pedido em montagem é de ${fornecedorCarrinho.nome}. Feche ou limpe esse pedido antes de juntar itens de outro fornecedor.`,
        variant: 'destructive',
      })
      return false
    }
    return true
  }

  // Linhas que o produto inteiro põe no pedido: os L com saldo (da empresa filtrada) ou, sem L,
  // o produto inteiro com o pendente total.
  function linhasDoProduto(row: NecessidadeCompraRow): LinhaCarrinho[] {
    const ls = (itensPorProduto.get(row.produto_id) ?? []).filter(
      (i) => selectedEmpresa === 'all' || i.empresa_id === selectedEmpresa,
    )
    if (ls.length > 0) return ls.map(linhaDoL).filter(Boolean) as LinhaCarrinho[]
    if (!row.fornecedor_id || selectedEmpresa !== 'all') return []
    return [
      {
        chave: `p:${row.produto_id}`,
        projeto_item_id: null,
        produto_id: row.produto_id,
        produto: row.produto,
        produto_codigo: row.produto_codigo != null ? String(row.produto_codigo) : null,
        orcamento_numero: null,
        l_fixo: null,
        pendente_item: row.pendente,
        preco_custo: row.preco_custo,
        fornecedor_id: row.fornecedor_id,
        fornecedor_nome: row.fornecedor_nome ?? '',
        empresa_id: null,
        empresa_nome: null,
      },
    ]
  }

  function toggleSelect(row: NecessidadeCompraRow) {
    if (produtosNoCarrinho.has(row.produto_id)) {
      setCarrinho((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([, l]) => l.produto_id !== row.produto_id)),
      )
      return
    }
    if (!fornecedorConfere(row.fornecedor_id)) return
    const novas = linhasDoProduto(row)
    if (novas.length === 0) return
    setCarrinho((prev) => ({ ...prev, ...Object.fromEntries(novas.map((l) => [l.chave, l])) }))
  }

  function toggleL(item: NecessidadeCompraItemRow) {
    const chave = `l:${item.projeto_item_id}`
    if (carrinho[chave]) {
      setCarrinho((prev) => {
        const next = { ...prev }
        delete next[chave]
        return next
      })
      return
    }
    const linha = linhaDoL(item)
    if (!linha) {
      toast({
        title: 'Sem fornecedor',
        description: 'Este produto/marca não tem fornecedor cadastrado.',
        variant: 'destructive',
      })
      return
    }
    if (!fornecedorConfere(linha.fornecedor_id)) return
    // L de um produto que estava inteiro no pedido substitui a linha do produto inteiro
    setCarrinho((prev) => {
      const next = { ...prev }
      delete next[`p:${item.produto_id}`]
      next[chave] = linha
      return next
    })
  }

  // Reuniao 04/08/2026: Debora filtrou por marca e queria selecionar todos de uma vez. Junta no
  // pedido os produtos filtrados do mesmo fornecedor — os de outro fornecedor ficam de fora com aviso.
  const selecionaveisFiltrados = filteredRows.filter((r) => r.fornecedor_id)
  const todosFiltradosSelecionados =
    selecionaveisFiltrados.length > 0 &&
    selecionaveisFiltrados.every((r) => produtosNoCarrinho.has(r.produto_id))

  function selecionarTodosFiltrados() {
    if (todosFiltradosSelecionados) {
      setCarrinho({})
      return
    }
    if (selecionaveisFiltrados.length === 0) return
    const fornecedorAlvo = fornecedorCarrinho?.id ?? selecionaveisFiltrados[0].fornecedor_id
    const compativel = selecionaveisFiltrados.filter((r) => r.fornecedor_id === fornecedorAlvo)
    const ignorados = selecionaveisFiltrados.length - compativel.length
    const novas = compativel.flatMap((r) => linhasDoProduto(r))
    setCarrinho((prev) => ({ ...prev, ...Object.fromEntries(novas.map((l) => [l.chave, l])) }))
    if (ignorados > 0) {
      toast({
        title: `${compativel.length} produto(s) no pedido`,
        description: `${ignorados} produto(s) de outro fornecedor ficaram de fora — feche este pedido primeiro ou filtre por marca.`,
      })
    }
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
          Déficit de estoque por item vendido/aprovado — selecione um produto para comprar por item
          de orçamento (L Fixo) no painel ao lado.
        </p>
      </div>

      {/* SPEC-104: aba "Devolução" (SPEC-054) removida desta rotina de
          Compras a pedido explícito do usuário — "essa coisa nem deveria
          ter aqui nessa rotina de compra". SPEC-103 (parte 1): aba "Por Item
          de Orçamento" (SPEC-040) também removida — a compra por L Fixo
          individual passou a viver dentro do painel lateral
          (NecessidadeDetailsPanel.tsx) ao selecionar um produto aqui, em vez
          de exigir trocar de aba. Nenhuma das duas funcionalidades foi
          apagada: devolução continua acessível pelo fluxo do orçamento
          (SPEC-071); compra por item de orçamento continua existindo, só
          mudou de lugar. */}
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        <div className="flex flex-col h-full min-h-0 gap-4">
          <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4 shrink-0">
            <div className="flex gap-2 w-full sm:w-auto">
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

          {/* SPEC-209 A6: pedido em montagem sempre à vista */}
          {linhasCarrinho.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shrink-0">
              <div className="text-sm text-emerald-900">
                <span className="font-semibold">Pedido em montagem:</span>{' '}
                {linhasCarrinho.length} linha(s) de {produtosNoCarrinho.size} produto(s) ·{' '}
                {fornecedorCarrinho?.nome}
                {(() => {
                  const emp = Array.from(
                    new Set(linhasCarrinho.map((l) => l.empresa_nome).filter(Boolean)),
                  )
                  return emp.length > 0 ? ` · venda: ${emp.join(', ')}` : ''
                })()}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-600"
                  onClick={() => setCarrinho({})}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={() => setFecharPedidoOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Fechar pedido ({linhasCarrinho.length})
                </Button>
              </div>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="flex gap-3 shrink-0">
              <SummaryCard label="Produtos com necessidade" value={rows.length} color="amber" />
              <SummaryCard
                label="Total unidades pendentes"
                value={Math.round(totalPendente * 1000) / 1000}
                color="red"
              />
            </div>
          )}

          <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
            <div className="w-full xl:flex-1 flex flex-col gap-3 min-w-0 min-h-0">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por código, referência, nome ou marca (aceita vários termos)..."
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
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger className="w-full sm:w-[220px] h-9 bg-slate-50 border-slate-200 text-sm">
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {empresasDisponiveis.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Table className="min-w-[1180px] w-full table-fixed">
                    <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <TableRow className="h-11">
                        <TableHead className="w-[40px] pl-4 sm:pl-6 text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          <Checkbox
                            checked={todosFiltradosSelecionados}
                            onCheckedChange={() => selecionarTodosFiltrados()}
                            title="Pôr no pedido todos os produtos filtrados (mesmo fornecedor)"
                          />
                        </TableHead>
                        <TableHead className="w-[100px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Código
                        </TableHead>
                        <TableHead className="w-[130px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Referência
                        </TableHead>
                        <TableHead className="w-[280px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Produto
                        </TableHead>
                        <TableHead className="w-[150px] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Marca
                        </TableHead>
                        <TableHead className="w-[100px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Estoque
                        </TableHead>
                        <TableHead className="w-[110px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Disponível
                        </TableHead>
                        <TableHead className="w-[110px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                          Pendente
                        </TableHead>
                        <TableHead className="w-[100px] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
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
                          <TableCell colSpan={10} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs text-slate-500">Carregando...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : visibleRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="h-40 text-center">
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
                              <TableCell colSpan={10} className="p-0">
                                <NecessidadeCompraDetalhe
                                  produtoId={r.produto_id}
                                  selecionados={lsNoCarrinho}
                                  onToggleL={toggleL}
                                  empresaFiltro={selectedEmpresa}
                                />
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
                                  checked={produtosNoCarrinho.has(r.produto_id)}
                                  disabled={!r.fornecedor_id}
                                  onCheckedChange={() => toggleSelect(r)}
                                  title={
                                    r.fornecedor_id
                                      ? 'Pôr no pedido todos os L deste produto (ou abra "Projetos" e marque só os L que quiser)'
                                      : 'Sem fornecedor resolvido (produto/marca sem fornecedor cadastrado)'
                                  }
                                />
                              </TableCell>
                              <TableCell className="align-middle py-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold whitespace-nowrap">
                                  {r.produto_codigo || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="align-middle py-2">
                                <span
                                  className="block truncate font-mono text-xs text-slate-700"
                                  title={r.referencia ?? undefined}
                                >
                                  {r.referencia || '-'}
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
                              <TableCell className="text-right align-middle py-2">
                                <span className="text-sm text-slate-600">
                                  {formatQty(r.qtd_fisica)}
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
                                  {formatQty(r.qtd_disponivel)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right align-middle py-2">
                                <span className="inline-flex items-center gap-1 justify-end">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  <span className="font-bold text-red-600 text-sm">
                                    {formatQty(r.pendente)}
                                  </span>
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
                                <div className="flex justify-end gap-1">
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
                                </div>
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


          <ModalGerarCompraItemOrcamento
            open={fecharPedidoOpen}
            onOpenChange={setFecharPedidoOpen}
            itens={linhasCarrinho}
            fornecedorId={fornecedorCarrinho?.id ?? ''}
            fornecedorNome={fornecedorCarrinho?.nome ?? ''}
            onSuccess={() => {
              setFecharPedidoOpen(false)
              setCarrinho({})
              loadData()
            }}
          />
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
