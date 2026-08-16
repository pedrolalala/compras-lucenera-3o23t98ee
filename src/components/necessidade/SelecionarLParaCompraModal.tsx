import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Loader2, PackageCheck, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getEntregaFuturaPorProduto,
  type NecessidadeCompraRow,
} from '@/services/necessidade-compra'
import {
  getNecessidadeCompraItemPorProduto,
  type NecessidadeCompraItemRow,
} from '@/services/necessidade-compra-item'

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

export interface ItemComCliente extends NecessidadeCompraItemRow {
  cliente: string | null
  dias_em_aberto: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: NecessidadeCompraRow | null
  onConfirmar: (
    itens: ItemComCliente[],
    fornecedorId: string,
    fornecedorNome: string,
  ) => void
}

// SPEC-103 (parte 1, rev.): card de seleção por L virou modal de verdade —
// o card lateral (largura ~320px) ficava apertado demais pra escolher entre
// vários L's, achado direto do usuário ao testar ao vivo. Mesmo padrão
// visual do "Buscar Venda de Origem" da Devolução (DevolucaoItemSearchModal),
// mais espaço pra Orçamento/L/Cliente/Fornecedor lado a lado.
export function SelecionarLParaCompraModal({
  open,
  onOpenChange,
  produto,
  onConfirmar,
}: Props) {
  const [itens, setItens] = useState<ItemComCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !produto) {
      setItens([])
      setSelectedIds(new Set())
      return
    }
    let cancelled = false
    setLoading(true)
    setSelectedIds(new Set())
    Promise.all([
      getNecessidadeCompraItemPorProduto(produto.produto_id),
      getEntregaFuturaPorProduto(produto.produto_id),
    ])
      .then(([itemRows, entregaRows]) => {
        if (cancelled) return
        const entregaPorItem = new Map(entregaRows.map((r) => [r.projeto_item_id, r]))
        setItens(
          itemRows.map((r) => ({
            ...r,
            cliente: entregaPorItem.get(r.projeto_item_id)?.cliente ?? null,
            dias_em_aberto: entregaPorItem.get(r.projeto_item_id)?.dias_em_aberto ?? null,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setItens([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, produto])

  function toggleSelect(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const selectedItens = itens.filter((it) => selectedIds.has(it.projeto_item_id))
  // fornecedor_id é resolvido por produto/marca — igual em todas as linhas
  // deste produto (ver necessidade-compra-item.ts).
  const fornecedorId = selectedItens[0]?.fornecedor_id ?? ''
  const fornecedorNome = selectedItens[0]?.fornecedor_nome ?? ''

  function handleConfirmar() {
    onConfirmar(selectedItens, fornecedorId, fornecedorNome)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[85vh] w-[90vw] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Comprar por Item (L) — {produto?.produto}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : itens.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground text-center px-6">
              Nenhum item de orçamento com necessidade pendente pra este produto.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Orçamento</TableHead>
                  <TableHead>L</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => {
                  const checked = selectedIds.has(it.projeto_item_id)
                  return (
                    <TableRow
                      key={it.projeto_item_id}
                      data-state={checked ? 'selected' : undefined}
                      className={cn('cursor-pointer', checked && 'bg-primary/5')}
                      onClick={() => it.fornecedor_id && toggleSelect(it.projeto_item_id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          disabled={!it.fornecedor_id}
                          onCheckedChange={() => toggleSelect(it.projeto_item_id)}
                          title={
                            it.fornecedor_id
                              ? undefined
                              : 'Sem fornecedor resolvido (produto/marca sem fornecedor cadastrado)'
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-700">
                        {it.orcamento_numero ?? '—'}
                      </TableCell>
                      <TableCell>
                        {it.l_fixo ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-xs font-semibold">
                            {it.l_fixo}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {it.cliente ?? 'Cliente não identificado'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {it.fornecedor_nome ?? 'Sem fornecedor cadastrado'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 tabular-nums">
                        {it.pendente_item}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap',
                            diasEmAbertoColor(it.dias_em_aberto),
                          )}
                        >
                          {formatDiasEmAberto(it.dias_em_aberto)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} linha(s) selecionada(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={selectedIds.size === 0}>
              <PackageCheck className="w-4 h-4 mr-2" />
              Gerar Compra ({selectedIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
