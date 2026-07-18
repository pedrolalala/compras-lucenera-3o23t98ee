import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, X, RefreshCw, Tags, Pencil, Loader2, Check, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getMarcasComFornecedor,
  atualizarFornecedorMarca,
  getSugestoesFornecedorMarca,
  type MarcaComFornecedor,
  type SugestaoFornecedorMarca,
} from '@/services/marcas'
import { getFornecedores, type Fornecedor } from '@/services/pedido-compra'
import {
  ModalRevisarSugestoesFornecedor,
  type SugestaoRevisao,
} from '@/components/marcas/ModalRevisarSugestoesFornecedor'

// SPEC-034: limiares de exibição/lote da sugestão automática de fornecedor
// por nome (RPC sugerir_fornecedores_marcas). Constantes no frontend,
// ajustáveis sem nova migration — ver seção 5 da SPEC-034 para a análise
// empírica que embasou os valores iniciais.
const LIMIAR_SUGESTAO_FORTE = 0.9 // badge "Sugestão forte", elegível para lote
const LIMIAR_SUGESTAO_MINIMA = 0.6 // abaixo disso, nenhuma sugestão é exibida

export default function Marcas() {
  const { toast } = useToast()

  const [marcas, setMarcas] = useState<MarcaComFornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // SPEC-034: sugestão automática de fornecedor por marca (RPC
  // sugerir_fornecedores_marcas). Não depende do texto de busca — carregada
  // junto do carregamento inicial e do botão "Atualizar", não a cada tecla
  // digitada no filtro (ver isFirstRender abaixo).
  const [sugestoes, setSugestoes] = useState<Map<string, SugestaoFornecedorMarca>>(new Map())
  const [modalRevisaoOpen, setModalRevisaoOpen] = useState(false)
  const isFirstSearchEffect = useRef(true)

  // Edição inline do fornecedor por linha — reaproveita a busca fuzzy
  // (getFornecedores, mesma RPC buscar_fornecedores_fuzzy) e o mesmo padrão
  // visual (Input + lista suspensa) já usado em ModalRegistrarCompra.tsx,
  // sem introduzir um componente de combobox novo (SPEC-033).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fornecedorSearch, setFornecedorSearch] = useState('')
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loadingFornecedores, setLoadingFornecedores] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadMarcas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMarcasComFornecedor(debouncedSearch || undefined)
      setMarcas(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar marcas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, toast])

  const loadSugestoes = useCallback(async () => {
    try {
      const data = await getSugestoesFornecedorMarca()
      setSugestoes(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar sugestões de fornecedor.',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Carregamento inicial e botão "Atualizar": marcas + sugestões em
  // paralelo (SPEC-034, seção 5).
  const loadData = useCallback(async () => {
    await Promise.all([loadMarcas(), loadSugestoes()])
  }, [loadMarcas, loadSugestoes])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mudança no filtro de busca (debounced): recarrega só as marcas — as
  // sugestões não dependem do termo digitado (SPEC-034).
  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false
      return
    }
    loadMarcas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // Marcas sem fornecedor primeiro (prioriza o backfill), depois por
  // quantidade de produtos ativos vinculados (maior impacto primeiro) —
  // só uma sugestão de ordenação de UI (SPEC-033), não decisão de dado.
  const sortedMarcas = useMemo(() => {
    return [...marcas].sort((a, b) => {
      const aSemFornecedor = a.fornecedor_id ? 0 : 1
      const bSemFornecedor = b.fornecedor_id ? 0 : 1
      if (aSemFornecedor !== bSemFornecedor) return bSemFornecedor - aSemFornecedor
      return b.qtd_produtos_ativos - a.qtd_produtos_ativos
    })
  }, [marcas])

  const totalSemFornecedor = useMemo(() => marcas.filter((m) => !m.fornecedor_id).length, [marcas])

  // SPEC-034: candidatos de alta confiança (score >= LIMIAR_SUGESTAO_FORTE)
  // entre as marcas ainda sem fornecedor — alimenta o card "Sugestões
  // fortes" e a lista revisada pelo ModalRevisarSugestoesFornecedor.
  const sugestoesFortes = useMemo<SugestaoRevisao[]>(() => {
    return marcas
      .filter((m) => !m.fornecedor_id)
      .map((m) => {
        const s = sugestoes.get(m.id)
        if (!s || s.score < LIMIAR_SUGESTAO_FORTE) return null
        return {
          marcaId: m.id,
          marcaNome: m.nome,
          fornecedorId: s.fornecedorId,
          fornecedorNome: s.fornecedorNome,
          score: s.score,
        }
      })
      .filter((s): s is SugestaoRevisao => s !== null)
      .sort((a, b) => b.score - a.score)
  }, [marcas, sugestoes])

  function iniciarEdicao(marcaId: string) {
    setEditingId(marcaId)
    setFornecedorSearch('')
    setFornecedores([])
    carregarFornecedores('')
  }

  function cancelarEdicao() {
    setEditingId(null)
    setFornecedorSearch('')
    setFornecedores([])
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!editingId) return
    debounceRef.current = setTimeout(() => {
      carregarFornecedores(fornecedorSearch)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedorSearch, editingId])

  async function carregarFornecedores(search: string) {
    setLoadingFornecedores(true)
    try {
      const data = await getFornecedores(search || undefined)
      setFornecedores(data)
    } catch {
      // silencioso — não bloqueia a edição, mesmo padrão de ModalRegistrarCompra
    } finally {
      setLoadingFornecedores(false)
    }
  }

  // SPEC-034: retorna boolean (sucesso/falha) além de manter o comportamento
  // já existente (toast individual, atualização de estado local, tratamento
  // de erro de RLS) — o valor de retorno é usado só pelo fluxo em lote
  // (handleConfirmarLote) para montar o toast-resumo; as chamadas
  // individuais já existentes (clique em "Confirmar"/seleção manual) seguem
  // ignorando o retorno.
  async function selecionarFornecedor(marcaId: string, fornecedor: Fornecedor): Promise<boolean> {
    setSavingId(marcaId)
    try {
      await atualizarFornecedorMarca(marcaId, fornecedor.id)
      setMarcas((prev) =>
        prev.map((m) =>
          m.id === marcaId
            ? { ...m, fornecedor_id: fornecedor.id, fornecedor_nome: fornecedor.nome }
            : m,
        ),
      )
      toast({
        title: 'Fornecedor atualizado',
        description: `${fornecedor.nome} vinculado com sucesso.`,
      })
      cancelarEdicao()
      return true
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar fornecedor',
        description:
          err?.message ??
          'Verifique se seu usuário tem permissão de admin/gerente e tente novamente.',
        variant: 'destructive',
      })
      return false
    } finally {
      setSavingId(null)
    }
  }

  // SPEC-034: chamada pelo modal de revisão em lote (ModalRevisarSugestoesFornecedor).
  // Percorre as marcas selecionadas sequencialmente (não Promise.all), para
  // não disparar dezenas de UPDATE simultâneos contra o Supabase, reusando
  // exatamente selecionarFornecedor (mesmo caminho de persistência/erro do
  // fluxo individual).
  async function handleConfirmarLote(marcaIds: string[]) {
    let sucesso = 0
    let falhas = 0
    for (const marcaId of marcaIds) {
      const sugestao = sugestoes.get(marcaId)
      if (!sugestao) {
        falhas++
        continue
      }
      const ok = await selecionarFornecedor(marcaId, {
        id: sugestao.fornecedorId,
        nome: sugestao.fornecedorNome,
      })
      if (ok) sucesso++
      else falhas++
    }

    toast({
      title: falhas === 0 ? 'Vínculos aplicados' : 'Aplicação concluída com falhas',
      description:
        falhas === 0
          ? `${sucesso} vínculo(s) aplicado(s).`
          : `${sucesso} aplicado(s), ${falhas} falharam.`,
      variant: falhas === 0 ? 'default' : 'destructive',
    })
    setModalRevisaoOpen(false)
  }

  async function removerFornecedor(marcaId: string) {
    setSavingId(marcaId)
    try {
      await atualizarFornecedorMarca(marcaId, null)
      setMarcas((prev) =>
        prev.map((m) =>
          m.id === marcaId ? { ...m, fornecedor_id: null, fornecedor_nome: null } : m,
        ),
      )
      toast({ title: 'Vínculo removido', description: 'A marca ficou sem fornecedor padrão.' })
      cancelarEdicao()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover vínculo',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 xl:h-[calc(100vh-130px)] animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Marcas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Fornecedor padrão de cada marca — usado para resolver o fornecedor de um produto no
            Pedido em Lote.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {!loading && sugestoesFortes.length > 0 && (
            <Button
              onClick={() => setModalRevisaoOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Aplicar sugestões fortes ({sugestoesFortes.length})
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

      {!loading && marcas.length > 0 && (
        <div className="flex flex-wrap gap-3 shrink-0">
          <SummaryCard label="Marcas cadastradas" value={marcas.length} color="slate" />
          <SummaryCard label="Sem fornecedor" value={totalSemFornecedor} color="amber" />
          <SummaryCard label="Sugestões fortes" value={sugestoesFortes.length} color="emerald" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome da marca..."
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

        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 shrink-0">
          {loading ? 'Carregando...' : `${sortedMarcas.length} marca(s)`}
        </div>

        <div className="overflow-auto flex-1">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="pl-4 sm:pl-6 w-[28%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Marca
                </TableHead>
                <TableHead className="w-[40%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Fornecedor atual
                </TableHead>
                <TableHead className="w-[16%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Produtos ativos
                </TableHead>
                <TableHead className="pr-4 sm:pr-6 w-[16%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Ação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500">Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedMarcas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <Tags className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">
                        {searchInput ? 'Nenhuma marca encontrada' : 'Nenhuma marca cadastrada'}
                      </p>
                      {searchInput && <p className="text-sm mt-1">Tente ajustar a busca.</p>}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedMarcas.map((m) => {
                  const isEditing = editingId === m.id
                  const isSaving = savingId === m.id
                  // SPEC-034: sugestão exibível só para marcas ainda sem
                  // fornecedor (a RPC já filtra por fornecedor_id IS NULL,
                  // mas o score mínimo de exibição fica no frontend).
                  const sugestao = sugestoes.get(m.id)
                  const sugestaoExibivel =
                    sugestao && sugestao.score >= LIMIAR_SUGESTAO_MINIMA ? sugestao : null
                  return (
                    <TableRow key={m.id} className="h-14 border-b border-slate-50">
                      <TableCell className="pl-4 sm:pl-6 align-middle py-2">
                        <p className="text-sm font-medium text-slate-900 line-clamp-1">{m.nome}</p>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        {isEditing ? (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <Input
                              autoFocus
                              placeholder="Buscar fornecedor..."
                              className="pl-8 h-9 text-sm"
                              value={fornecedorSearch}
                              onChange={(e) => setFornecedorSearch(e.target.value)}
                              autoComplete="off"
                              disabled={isSaving}
                            />
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-52">
                              {loadingFornecedores ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                </div>
                              ) : fornecedores.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">
                                  Nenhum fornecedor encontrado.
                                </p>
                              ) : (
                                fornecedores.map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800 border-b border-slate-100 last:border-0"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      selecionarFornecedor(m.id, f)
                                    }}
                                  >
                                    {f.nome}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : m.fornecedor_nome ? (
                          <span className="text-sm text-slate-700 line-clamp-1">
                            {m.fornecedor_nome}
                          </span>
                        ) : sugestaoExibivel ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={cn(
                                'border font-medium',
                                sugestaoExibivel.score >= LIMIAR_SUGESTAO_FORTE
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700',
                              )}
                            >
                              {sugestaoExibivel.score >= LIMIAR_SUGESTAO_FORTE
                                ? 'Sugestão forte'
                                : 'Sugestão'}
                            </Badge>
                            <span className="text-sm text-slate-700 line-clamp-1">
                              {sugestaoExibivel.fornecedorNome}
                            </span>
                            <span className="text-xs text-slate-400 tabular-nums">
                              {Math.round(sugestaoExibivel.score * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-amber-600 italic">Sem fornecedor</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-middle py-2">
                        <span className="text-sm text-slate-600 tabular-nums">
                          {m.qtd_produtos_ativos}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-6 text-right align-middle py-2">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            {m.fornecedor_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                disabled={isSaving}
                                onClick={() => removerFornecedor(m.id)}
                              >
                                Remover
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-slate-500"
                              disabled={isSaving}
                              onClick={cancelarEdicao}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            {sugestaoExibivel && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                disabled={isSaving}
                                onClick={() =>
                                  selecionarFornecedor(m.id, {
                                    id: sugestaoExibivel.fornecedorId,
                                    nome: sugestaoExibivel.fornecedorNome,
                                  })
                                }
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Confirmar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              disabled={isSaving}
                              onClick={() => iniciarEdicao(m.id)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ModalRevisarSugestoesFornecedor
        open={modalRevisaoOpen}
        onOpenChange={setModalRevisaoOpen}
        sugestoes={sugestoesFortes}
        onConfirmar={handleConfirmarLote}
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
  color: 'slate' | 'amber' | 'emerald'
}) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-2 flex items-center gap-3', colorMap[color])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80 max-w-[120px] leading-tight">{label}</p>
    </div>
  )
}
