import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getItensDoPedido, type ItemDoPedido } from '@/services/pedido-compra'
import { brl } from '@/components/compra/custo-compra'

// SPEC-209: itens do pedido ao abrir a linha em Pedidos — pedido x recebido (entrada) por item.
// SPEC-291: em pedido "Concluído parcialmente" lista primeiro só o que falta; as peças 100% recebidas
// ficam recolhidas em "Já recebidas".
export function PedidoItensResumo({ pedidoId, parcial = false }: { pedidoId: string; parcial?: boolean }) {
  const [itens, setItens] = useState<ItemDoPedido[] | null>(null)
  const [erro, setErro] = useState(false)
  const [verRecebidas, setVerRecebidas] = useState(false)

  useEffect(() => {
    setItens(null)
    setErro(false)
    setVerRecebidas(false)
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

  const faltando = parcial ? itens.filter((i) => i.qtd_recebida < i.quantidade) : itens
  const recebidas = parcial ? itens.filter((i) => i.qtd_recebida >= i.quantidade) : []

  const linhaProduto = (i: ItemDoPedido) => (
    <td className="py-1 text-slate-700">
      {i.produto_codigo && <span className="font-mono text-slate-400 mr-1.5">{i.produto_codigo}</span>}
      {i.produto_nome}
    </td>
  )

  return (
    <div className="px-10 pt-3 pb-1 bg-slate-50/60">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
        {parcial ? 'O que falta chegar' : 'Itens'}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-medium py-1">Produto</th>
            <th className="text-right font-medium py-1 w-24">Pedido</th>
            <th className="text-right font-medium py-1 w-24">Recebido</th>
            {parcial && <th className="text-right font-medium py-1 w-24">Falta</th>}
            <th className="text-right font-medium py-1 w-28">Custo/un.</th>
            <th className="text-right font-medium py-1 w-28">{parcial ? 'Total que falta' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          {faltando.map((i) => {
            const falta = Math.max(0, i.quantidade - i.qtd_recebida)
            return (
              <tr key={i.id} className="border-t border-slate-200/70">
                {linhaProduto(i)}
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
                {parcial && <td className="py-1 text-right tabular-nums font-semibold text-orange-600">{falta}</td>}
                <td className="py-1 text-right tabular-nums">{brl(i.custo_unitario)}</td>
                <td className="py-1 text-right tabular-nums">
                  {brl(i.custo_unitario * (parcial ? falta : i.quantidade))}
                </td>
              </tr>
            )
          })}
          {parcial && faltando.length === 0 && (
            <tr>
              <td colSpan={6} className="py-2 text-slate-400">
                Nenhuma peça com saldo a receber.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {recebidas.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="text-[11px] font-medium text-emerald-700 hover:underline"
            onClick={() => setVerRecebidas((v) => !v)}
          >
            Já recebidas ({recebidas.length}) — {verRecebidas ? 'esconder' : 'ver'}
          </button>
          {verRecebidas && (
            <table className="w-full text-xs mt-1">
              <tbody>
                {recebidas.map((i) => (
                  <tr key={i.id} className="border-t border-slate-200/70 text-slate-500">
                    {linhaProduto(i)}
                    <td className="py-1 text-right tabular-nums w-24">{i.quantidade}</td>
                    <td className="py-1 text-right tabular-nums w-24 text-emerald-700 font-semibold">
                      {i.qtd_recebida}
                    </td>
                    <td className="py-1 text-right tabular-nums w-24">0</td>
                    <td className="py-1 text-right tabular-nums w-28">{brl(i.custo_unitario)}</td>
                    <td className="py-1 text-right tabular-nums w-28">
                      {brl(i.custo_unitario * i.quantidade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
