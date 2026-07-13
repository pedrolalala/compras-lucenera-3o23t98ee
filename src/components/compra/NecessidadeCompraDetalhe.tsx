import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  getNecessidadeCompraDetalhe,
  type NecessidadeCompraDetalheRow,
} from '@/services/necessidade-compra-detalhe'

interface Props {
  produtoId: string
}

export function NecessidadeCompraDetalhe({ produtoId }: Props) {
  const [rows, setRows] = useState<NecessidadeCompraDetalheRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getNecessidadeCompraDetalhe(produtoId)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [produtoId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Carregando projetos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-3 px-6 text-xs text-red-500">
        Erro ao carregar detalhes. Tente novamente.
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-3 px-6 text-xs text-slate-400 italic">
        Nenhum projeto vinculado com saldo ativo.
      </div>
    )
  }

  return (
    <div className="bg-slate-50/70 border-b border-slate-100">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="h-8 bg-slate-100/80 hover:bg-slate-100/80">
            <TableHead className="pl-10 w-[22%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
              Projeto
            </TableHead>
            <TableHead className="w-[12%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
              Orçamento
            </TableHead>
            <TableHead className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
              Para quem vai
            </TableHead>
            <TableHead className="w-[11%] hidden lg:table-cell text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
              Vendido
            </TableHead>
            <TableHead className="w-[11%] hidden xl:table-cell text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
              Coberto
            </TableHead>
            <TableHead className="w-[11%] text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
              A Comprar
            </TableHead>
            <TableHead className="w-[10%] pr-4 sm:pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.projeto_item_id}
              className="h-10 border-b border-slate-100/60 hover:bg-slate-100/40"
            >
              <TableCell className="pl-10 align-middle py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {r.projeto_codigo && (
                    <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold">
                      {r.projeto_codigo}
                    </span>
                  )}
                  <span className="text-xs text-slate-600 truncate">{r.projeto_nome ?? '—'}</span>
                </div>
              </TableCell>
              <TableCell className="align-middle py-1.5">
                <span className="text-xs text-slate-500">{r.orcamento_numero ?? '—'}</span>
              </TableCell>
              <TableCell className="align-middle py-1.5">
                <span className="text-xs text-slate-700 font-medium">{r.cliente ?? '—'}</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-right align-middle py-1.5">
                <span className="text-xs text-slate-500 tabular-nums">{r.qtd_vendida}</span>
              </TableCell>
              <TableCell className="hidden xl:table-cell text-right align-middle py-1.5">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    r.q_reserva > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400',
                  )}
                >
                  {r.q_reserva}
                </span>
              </TableCell>
              <TableCell className="text-right align-middle py-1.5">
                <span
                  className={cn(
                    'text-xs tabular-nums font-semibold',
                    r.q_entrega_futura > 0 ? 'text-red-600' : 'text-slate-400',
                  )}
                >
                  {r.q_entrega_futura}
                </span>
              </TableCell>
              <TableCell className="pr-4 sm:pr-6" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
