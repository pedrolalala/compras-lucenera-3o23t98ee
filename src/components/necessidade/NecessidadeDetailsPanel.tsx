import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ShoppingCart, Hash, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getEntregaFuturaPorProduto,
  type NecessidadeCompraRow,
  type EntregaFuturaRow,
} from '@/services/necessidade-compra'

function formatDate(v: string | null | undefined) {
  if (!v) return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

export function NecessidadeDetailsPanel({ produto }: { produto: NecessidadeCompraRow | null }) {
  const [rows, setRows] = useState<EntregaFuturaRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!produto) {
      setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    getEntregaFuturaPorProduto(produto.produto_id)
      .then((data) => { if (!cancelled) setRows(data) })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [produto])

  if (!produto) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1">
        <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
          <ShoppingCart className="w-12 h-12 mb-4 text-slate-200" />
          <h3 className="font-medium text-slate-900 mb-1">Nenhum produto selecionado</h3>
          <p className="text-sm">Clique em um produto para ver a entrega futura por projeto.</p>
        </div>
      </div>
    )
  }

  const totalEntregaFutura = rows.reduce((s, r) => s + r.q_entrega_futura, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1 min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-900 leading-tight break-words">{produto.produto}</h3>
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

      <div className="px-4 sm:px-5 pb-5 pt-4 flex flex-col gap-3 flex-1">
        <h4 className="text-sm font-semibold flex items-center text-slate-700">
          <Package className="w-4 h-4 mr-2 text-slate-400" />
          Entrega Futura por Projeto
        </h4>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="border rounded-lg bg-slate-50 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-slate-500">Nenhum item com entrega futura encontrado.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-slate-50 flex-1 min-w-0">
            <Table>
              <TableHeader className="bg-slate-100/80">
                <TableRow>
                  <TableHead className="h-9 py-2 px-2 text-[11px] text-slate-600">Projeto</TableHead>
                  <TableHead className="h-9 py-2 px-2 text-[11px] text-slate-600">Cliente</TableHead>
                  <TableHead className="h-9 py-2 px-2 text-[11px] text-slate-600 text-right">
                    Qtd Venda
                  </TableHead>
                  <TableHead className="h-9 py-2 px-2 text-[11px] text-slate-600 text-right">
                    Entrega Futura
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.projeto_item_id} className="h-10 hover:bg-slate-100/50">
                    <TableCell className="py-2 px-2 text-xs">
                      <span className="font-mono font-semibold text-slate-700">
                        {r.projeto_codigo || '-'}
                      </span>
                      {r.orcamento_numero && (
                        <div className="text-[10px] text-slate-400">{r.orcamento_numero}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-xs text-slate-600 max-w-[100px]">
                      <span className="block truncate">{r.cliente || '-'}</span>
                    </TableCell>
                    <TableCell className="py-2 px-2 text-xs text-right text-slate-600">
                      {r.q_venda}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-xs text-right">
                      <span className="font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                        {r.q_entrega_futura}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-slate-100/80 border-t border-slate-200">
                <TableRow className="h-10">
                  <TableCell colSpan={3} className="py-2 px-2 text-xs font-bold text-slate-700">
                    Total Entrega Futura
                  </TableCell>
                  <TableCell className="py-2 px-2 text-right">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500 text-white">
                      {totalEntregaFutura}
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-[11px] text-slate-400 text-center">
            Atualizado em {formatDate(rows[0]?.atualizado_em)}
          </p>
        )}
      </div>
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
