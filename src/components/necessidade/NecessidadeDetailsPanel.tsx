import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ShoppingCart, Hash, Package, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEntregaFuturaPorProduto, type NecessidadeCompraRow } from '@/services/necessidade-compra'
import {
  getNecessidadeCompraItemPorProduto,
  type NecessidadeCompraItemRow,
} from '@/services/necessidade-compra-item'
import { ModalGerarCompraItemOrcamento } from '@/components/compra/ModalGerarCompraItemOrcamento'

function formatDate(v: string | null | undefined) {
  if (!v) return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function formatDiasEmAberto(dias: number | null): string {
  if (dias === null || dias === undefined) return '-'
  if (dias === 0) return 'hoje'
  if (dias === 1) return '1 dia'
  if (dias < 14) return `${dias} dias`
  const semanas = Math.floor(dias / 7)
  if (dias < 30) return `${semanas} semana${semanas > 1 ? 's' : ''}`
  const meses = Math.floor(dias / 30)
  return `${meses} ${meses > 1 ? 'meses' : 'mês'}`
}

function diasEmAbertoColor(dias: number | null): string {
  if (dias === null || dias === undefined) return 'bg-slate-100 text-slate-600'
  if (dias >= 21) return 'bg-red-100 text-red-700'
  if (dias >= 7) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

interface ItemComCliente extends NecessidadeCompraItemRow {
  cliente: string | null
  dias_em_aberto: number | null
}

interface Props {
  produto: NecessidadeCompraRow | null
  // SPEC-103 (parte 1): notifica a tela pai (lista "Por Produto") depois de
  // gerar uma compra por L aqui dentro, pra recarregar pendente/necessidade.
  onPurchased?: () => void
}

export function NecessidadeDetailsPanel({ produto, onPurchased }: Props) {
  const [itens, setItens] = useState<ItemComCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)

  const produtoId = produto?.produto_id ?? null

  async function loadItens(id: string) {
    const [itemRows, entregaRows] = await Promise.all([
      getNecessidadeCompraItemPorProduto(id),
      getEntregaFuturaPorProduto(id),
    ])
    const entregaPorItem = new Map(entregaRows.map((r) => [r.projeto_item_id, r]))
    setItens(
      itemRows.map((r) => ({
        ...r,
        cliente: entregaPorItem.get(r.projeto_item_id)?.cliente ?? null,
        dias_em_aberto: entregaPorItem.get(r.projeto_item_id)?.dias_em_aberto ?? null,
      })),
    )
    setAtualizadoEm(entregaRows[0]?.atualizado_em ?? null)
  }

  useEffect(() => {
    if (!produtoId) {
      setItens([])
      setSelectedIds(new Set())
      return
    }
    let cancelled = false
    setLoading(true)
    setSelectedIds(new Set())
    loadItens(produtoId)
      .catch(() => {
        if (!cancelled) setItens([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [produtoId])

  function toggleSelect(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const selectedItens = useMemo(
    () => itens.filter((it) => selectedIds.has(it.projeto_item_id)),
    [itens, selectedIds],
  )

  // fornecedor_id é resolvido por produto/marca (cascata de
  // vw_necessidade_compra_item_orcamento) — igual em todas as linhas deste
  // produto, então basta olhar a primeira selecionada.
  const fornecedorId = selectedItens[0]?.fornecedor_id ?? ''
  const fornecedorNome = selectedItens[0]?.fornecedor_nome ?? ''

  function reload() {
    if (!produtoId) return
    setLoading(true)
    loadItens(produtoId)
      .catch(() => setItens([]))
      .finally(() => setLoading(false))
  }

  if (!produto) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1">
        <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
          <ShoppingCart className="w-12 h-12 mb-4 text-slate-200" />
          <h3 className="font-medium text-slate-900 mb-1">Nenhum produto selecionado</h3>
          <p className="text-sm">Clique em um produto para comprar por item de orçamento (L).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1 min-w-0 flex flex-col">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 shrink-0">
        <h3 className="font-semibold text-slate-900 leading-tight break-words">
          {produto.produto}
        </h3>
        {produto.produto_codigo && (
          <div className="flex items-center gap-1.5 mt-1">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-xs text-slate-600">{produto.produto_codigo}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatCard label="Física" value={produto.qtd_fisica} color="slate" />
          <StatCard label="Comprometida" value={produto.qtd_comprometida} color="amber" />
          <StatCard label="Necessidade" value={produto.necessidade_compra} color="red" />
        </div>
      </div>

      <div className="px-4 sm:px-5 pb-5 pt-4 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h4 className="text-sm font-semibold flex items-center text-slate-700">
            <Package className="w-4 h-4 mr-2 text-slate-400" />
            Comprar por Item (L)
          </h4>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              onClick={() => setModalOpen(true)}
            >
              <PackageCheck className="w-3.5 h-3.5 mr-1" />
              Gerar Compra ({selectedIds.size})
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-slate-100" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="border rounded-lg bg-slate-50 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-slate-500">Nenhum item de orçamento com necessidade pendente.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
            {itens.map((it) => {
              const checked = selectedIds.has(it.projeto_item_id)
              return (
                <label
                  key={it.projeto_item_id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition-colors',
                    checked
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!it.fornecedor_id}
                    onCheckedChange={() => toggleSelect(it.projeto_item_id)}
                    className="mt-0.5 shrink-0"
                    title={
                      it.fornecedor_id
                        ? undefined
                        : 'Sem fornecedor resolvido (produto/marca sem fornecedor cadastrado)'
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {it.orcamento_numero ?? '—'}
                      </span>
                      {it.l_fixo && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold">
                          {it.l_fixo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5">
                      {it.cliente ?? 'Cliente não identificado'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {it.fornecedor_nome ?? 'Sem fornecedor cadastrado'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="font-bold text-red-600 text-sm tabular-nums">
                      {it.pendente_item}
                    </span>
                    {it.dias_em_aberto !== null && (
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap',
                          diasEmAbertoColor(it.dias_em_aberto),
                        )}
                      >
                        {formatDiasEmAberto(it.dias_em_aberto)}
                      </span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {atualizadoEm && (
          <p className="text-[11px] text-slate-400 text-center shrink-0">
            Atualizado em {formatDate(atualizadoEm)}
          </p>
        )}
      </div>

      <ModalGerarCompraItemOrcamento
        open={modalOpen}
        onOpenChange={setModalOpen}
        itens={selectedItens}
        fornecedorId={fornecedorId}
        fornecedorNome={fornecedorNome}
        onSuccess={() => {
          setModalOpen(false)
          setSelectedIds(new Set())
          reload()
          onPurchased?.()
        }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'slate' | 'amber' | 'red'
}) {
  const colorMap = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <div className={cn('rounded-lg px-2 py-1.5 text-center', colorMap[color])}>
      <p className="text-[10px] font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold leading-none mt-0.5">{value}</p>
    </div>
  )
}
