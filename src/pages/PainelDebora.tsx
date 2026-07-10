import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getPendencias, reReservar, type PendenciaRow } from '@/services/re-reserva'

export default function PainelDebora() {
  const { toast } = useToast()
  const [rows, setRows] = useState<PendenciaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<PendenciaRow | null>(null)
  const [quantidade, setQuantidade] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendencias()
      setRows(data)
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar pendências.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openDialog = (item: PendenciaRow) => {
    setSelected(item)
    setQuantidade(item.qtd_pode_re_reservar)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    const result = await reReservar(selected.projeto_item_id, quantidade)
    if (result.success) {
      toast({ title: 'Sucesso', description: result.message })
      setDialogOpen(false)
      loadData()
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' })
    }
    setSubmitting(false)
  }

  const totalReReservar = rows.reduce((s, r) => s + r.qtd_pode_re_reservar, 0)

  return (
    <div className="flex flex-col space-y-4 w-full animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Painel da Débora
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Re-reserva de itens com entrega futura — transfira para reserva quando houver estoque
            disponível.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
          className="shadow-sm w-full sm:w-auto"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-2 flex items-center gap-3">
            <p className="text-2xl font-bold">{rows.length}</p>
            <p className="text-xs font-medium opacity-80 max-w-[100px] leading-tight">
              Itens pendentes de re-reserva
            </p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 text-green-800 px-4 py-2 flex items-center gap-3">
            <p className="text-2xl font-bold">{totalReReservar}</p>
            <p className="text-xs font-medium opacity-80 max-w-[100px] leading-tight">
              Total unidades a re-reservar
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <Table className="w-full">
            <TableHeader className="bg-slate-50 sticky top-0">
              <TableRow className="h-11">
                <TableHead className="pl-4 text-xs font-semibold uppercase text-slate-600">
                  Produto
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-slate-600">
                  Projeto
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-slate-600">
                  Cliente
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase text-slate-600">
                  Ent. Futura
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase text-slate-600">
                  Disponível
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase text-slate-600">
                  Pode Re-reservar
                </TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold uppercase text-slate-600">
                  Ação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-slate-500">
                    <CheckCircle2 className="w-10 h-10 mb-2 text-slate-300 mx-auto" />
                    Nenhuma pendência de re-reserva no momento.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.projeto_item_id}
                    className="h-14 border-b border-slate-50 hover:bg-slate-50/80"
                  >
                    <TableCell className="pl-4 py-2">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">{r.produto}</p>
                      <span className="font-mono text-xs text-slate-400">
                        {r.produto_codigo ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {r.projeto_codigo ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-sm text-slate-600">{r.cliente ?? '-'}</span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-sm text-amber-700 font-medium">
                        {r.q_entrega_futura}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-sm text-slate-600">{r.qtd_disponivel}</span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <AlertTriangle className="w-3.5 h-3.5 text-green-500" />
                        <span className="font-bold text-green-600 text-sm">
                          {r.qtd_pode_re_reservar}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 py-2 text-right">
                      <Button
                        size="sm"
                        onClick={() => openDialog(r)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Re-reservar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-reservar Item</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-slate-900">{selected.produto}</p>
                <p className="text-xs text-slate-500">
                  Projeto: {selected.projeto_codigo} · Cliente: {selected.cliente}
                </p>
                <p className="text-xs text-slate-500">
                  Entrega futura: {selected.q_entrega_futura} · Disponível:{' '}
                  {selected.qtd_disponivel}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtd">
                  Quantidade a re-reservar (máx: {selected.qtd_pode_re_reservar})
                </Label>
                <Input
                  id="qtd"
                  type="number"
                  min={1}
                  max={selected.qtd_pode_re_reservar}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || quantidade <= 0}>
              {submitting ? 'Processando...' : 'Confirmar Re-reserva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
