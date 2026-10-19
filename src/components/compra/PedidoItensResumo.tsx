import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getItensDoPedido, type ItemDoPedido } from '@/services/pedido-compra'
import { brl } from '@/components/compra/custo-compra'

// SPEC-209: itens do pedido ao abrir a linha em Pedidos — pedido x recebido (entrada) por item.
export function PedidoItensResumo({ pedidoId }: { pedidoId: string }) {
  const [itens, setItens] = useState<ItemDoPedido[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    setItens(null)
    setErro(false)
    getItensDoPedido(pedidoId)
      .then(setItens)
      .catch(() => setErro(true))
  }, [pedidoId])

  if (erro) return <p className="px-10 py-3 text-xs text-red-500">Erro ao carregar os itens.</p>
  if (!itens)
    return (
      <div className="flex items-center gap-2 px-10 py-3 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando itens...
      </div>
    )

  return (
    <div className="px-10 pt-3 pb-1 bg-slate-50/60">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">Itens</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-medium py-1">Produto</th>
            <th className="text-right font-medium py-1 w-24">Pedido</th>
            <th className="text-right font-medium py-1 w-24">Recebido</th>
            <th className="text-right font-medium py-1 w-28">Custo/un.</th>
            <th className="text-right font-medium py-1 w-28">Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id} className="border-t border-slate-200/70">
              <td className="py-1 text-slate-700">
                {i.produto_codigo && (
                  <span className="font-mono text-slate-400 mr-1.5">{i.produto_codigo}</span>
                )}
                {i.produto_nome}
              </td>
              <td className="py-1 text-right tabular-nums">{i.quantidade}</td>
              <td
                className={cn(
                  'py-1 text-right tabular-nums',
                  i.qtd_recebida >= i.quantidade
                    ? 'text-emerald-700 font-semibold'
                    : i.qtd_recebida > 0
                      ? 'text-orange-600 font-semibold'
                      : 'text-slate-400',
                )}
              >
                {i.qtd_recebida}
              </td>
              <td className="py-1 text-right tabular-nums">{brl(i.custo_unitario)}</td>
              <td className="py-1 text-right tabular-nums">{brl(i.custo_unitario * i.quantidade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
