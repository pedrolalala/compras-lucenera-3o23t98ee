import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Search,
  X,
  RefreshCw,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Ban,
  Loader2,
  CheckCircle2,
  Pencil,
  CalendarClock,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/StatusBadge'
import { PedidoParcelasPanel } from '@/components/compra/PedidoParcelasPanel'
import { PedidoItensResumo } from '@/components/compra/PedidoItensResumo'
import { EditarPedidoDialog } from '@/components/compra/EditarPedidoDialog'
import {
  getPedidosCompra,
  cancelarPedidoCompra,
  aprovarPedidoCompra,
  STATUS_PEDIDO_COMPRA,
  STATUS_PEDIDO_COMPRA_ABERTO,
  STATUS_PEDIDO_COMPRA_CANCELAVEL,
  type PedidoCompraRow,
} from '@/services/pedido-compra'

function fmtBRL(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Datas "AAAA-MM-DD" sem fuso (new Date() deslocaria 1 dia).
function fmtDia(v: string | null) {
  if (!v) return '—'
  const [a, m, d] = v.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : '—'
}

function diasAte(v: string | null): number | null {
  if (!v) return null
  const [a, m, d] = v.slice(0, 10).split('-').map(Number)
  const alvo = new Date(a, m - 1, d).getTime()
  const hoje = new Date()
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
  return Math.round((alvo - base) / 86400000)
}

// SPEC-209 D1/D6: a antiga tela "Solicitações" deixou de existir; o ciclo inteiro fica aqui, por aba.
const ABAS = [
  { value: 'abertos', label: 'Em aberto' },
  ...STATUS_PEDIDO_COMPRA,
  { value: 'todos', label: 'Todos' },
]

export default function PedidosCompra() {
  const { toast } = useToast()

  const [rows, setRows] = useState<PedidoCompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('abertos')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<PedidoCompraRow | null>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [aprovandoId, setAprovandoId] = useState<string | null>(null)
  const [pedidoParaEditar, setPedidoParaEditar] = useState<PedidoCompraRow | null>(null)

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

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: rows.length, abertos: 0 }
    rows.forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1
      if (STATUS_PEDIDO_COMPRA_ABERTO.includes(r.status)) c.abertos += 1
    })
    return c
  }, [rows])

  const rowsAba = useMemo(() => {
    if (aba === 'todos') return rows
    if (aba === 'abertos') return rows.filter((r) => STATUS_PEDIDO_COMPRA_ABERTO.includes(r.status))
    return rows.filter((r) => r.status === aba)
  }, [rows, aba])

  // SPEC-209 C3: pedidos em aberto que chegam nos próximos 10 dias (confirmar com o fornecedor).
  const chegando = useMemo(
    () =>
      rows
        .filter((r) => STATUS_PEDIDO_COMPRA_ABERTO.includes(r.status))
        .map((r) => ({ r, dias: diasAte(r.data_prevista_entrega) }))
        .filter((x) => x.dias != null && x.dias >= 0 && x.dias <= 10)
        .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0)),
    [rows],
  )

  function toggleExpand(pedidoId: string) {
    setExpandedId((prev) => (prev === pedidoId ? null : pedidoId))
  }

  function handleCancelClick(e: React.MouseEvent, pedido: PedidoCompraRow) {
    e.stopPropagation()
    setMotivoCancelamento('')
    setPedidoParaCancelar(pedido)
  }

  async function handleConfirmCancel() {
    if (!pedidoParaCancelar || !motivoCancelamento.trim()) return
    setCancelando(true)
    try {
      await cancelarPedidoCompra(pedidoParaCancelar.id, motivoCancelamento)
      toast({
        title: 'Pedido cancelado',
        description: `Pedido #${pedidoParaCancelar.numero}. A necessidade de compra dos itens voltou.`,
      })
      setPedidoParaCancelar(null)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCancelando(false)
    }
  }

  async function aprovar(e: React.MouseEvent, pedido: PedidoCompraRow) {
    e.stopPropagation()
    setAprovandoId(pedido.id)
    try {
      const r = await aprovarPedidoCompra(pedido.id)
      toast(
        r.parcelas > 0
          ? {
              title: `Pedido #${pedido.numero} aprovado`,
              description: `${r.parcelas} parcela(s) já no Contas a Pagar do Dashboard Financeiro.`,
            }
          : {
              title: `Pedido #${pedido.numero} aprovado, mas sem parcelas`,
              description:
                'Sem condição de pagamento ele não entra no Contas a Pagar. Abra o pedido e lance as parcelas.',
              variant: 'destructive',
            },
      )
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAprovandoId(null)
    }
  }

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 xl:h-[calc(100vh-130px)] animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Pedidos de Compra
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Aguardando aprovar → Aprovado (fornecedor confirmou; as parcelas entram no Contas a Pagar)
            → Concluído pela entrada da mercadoria. Edite enquanto o pedido aguarda aprovação.
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

      {chegando.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shrink-0">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Chegando nos próximos 10 dias — confirme com o fornecedor
          </p>
          <ul className="mt-1.5 text-sm text-amber-900 space-y-0.5">
            {chegando.map(({ r, dias }) => (
              <li key={r.id}>
                <span className="font-mono font-semibold">#{r.numero}</span> · {r.fornecedor_nome}{' '}
                · {fmtDia(r.data_prevista_entrega)} (
                {dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-wrap gap-1 px-3 pt-3 shrink-0">
          {ABAS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAba(a.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                aba === a.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {a.label}
              <span className="ml-1.5 text-xs opacity-75">{contagem[a.value] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border-b border-slate-100 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número do pedido ou fornecedor..."
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
          {loading ? 'Carregando...' : `${rowsAba.length} pedido(s)`}
        </div>

        <div className="overflow-auto flex-1">
          <Table className="w-full table-fixed min-w-[1000px]">
            <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <TableRow className="h-11">
                <TableHead className="w-[3%] pl-4 sm:pl-6" />
                <TableHead className="w-[9%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Número
                </TableHead>
                <TableHead className="text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Fornecedor
                </TableHead>
                <TableHead className="w-[11%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Empresa
                </TableHead>
                <TableHead className="w-[9%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Emissão
                </TableHead>
                <TableHead className="w-[9%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Previsão
                </TableHead>
                <TableHead className="w-[10%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Condições
                </TableHead>
                <TableHead className="w-[10%] text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Valor Total
                </TableHead>
                <TableHead className="w-[12%] text-slate-600 font-semibold text-xs uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="w-[19%] pr-4 sm:pr-6" />
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
              ) : rowsAba.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-40 text-center">
                    <div className="flex flex-col items-center text-slate-400">
                      <ShoppingCart className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-slate-600 font-medium">Nenhum pedido nesta aba</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rowsAba.flatMap((r) => {
                  const isExpanded = expandedId === r.id
                  const podeCancelar = STATUS_PEDIDO_COMPRA_CANCELAVEL.includes(r.status)
                  const aguardando = r.status === 'aguardando_aprovar'
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
                        <span className="text-xs text-slate-600 line-clamp-1">
                          {r.empresa_nome ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <span className="text-xs text-slate-500">{fmtDia(r.data_emissao)}</span>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <span className="text-xs text-slate-500">
                          {fmtDia(r.data_prevista_entrega)}
                        </span>
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
                      <TableCell className="align-middle py-2">
                        <StatusBadge status={r.status} />
                        {r.status === 'cancelado' && r.motivo_cancelamento && (
                          <p
                            className="text-[11px] text-slate-500 line-clamp-1 mt-0.5"
                            title={r.motivo_cancelamento}
                          >
                            {r.motivo_cancelamento}
                          </p>
                        )}
                      </TableCell>
                      <TableCell
                        className="pr-4 sm:pr-6 align-middle py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1 flex-wrap">
                          {aguardando && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPedidoParaEditar(r)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={aprovandoId === r.id}
                                onClick={(e) => aprovar(e, r)}
                              >
                                {aprovandoId === r.id ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                )}
                                Aprovar
                              </Button>
                            </>
                          )}
                          {podeCancelar && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => handleCancelClick(e, r)}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  const detailRow = isExpanded ? (
                    <TableRow key={`${r.id}-detalhe`} className="hover:bg-transparent">
                      <TableCell colSpan={10} className="p-0">
                        <PedidoItensResumo pedidoId={r.id} />
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

      <EditarPedidoDialog
        pedido={pedidoParaEditar}
        onOpenChange={(open) => {
          if (!open) setPedidoParaEditar(null)
        }}
        onSalvo={() => {
          setPedidoParaEditar(null)
          loadData()
        }}
      />

      <AlertDialog
        open={pedidoParaCancelar != null}
        onOpenChange={(open) => {
          if (!open) setPedidoParaCancelar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido #{pedidoParaCancelar?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens voltam para a Necessidade de Compra e as parcelas ainda não pagas são
              canceladas junto. Essa ação não pode ser desfeita pela tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Justificativa do cancelamento (obrigatória)"
            value={motivoCancelamento}
            onChange={(e) => setMotivoCancelamento(e.target.value)}
            disabled={cancelando}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmCancel()
              }}
              disabled={cancelando || !motivoCancelamento.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
