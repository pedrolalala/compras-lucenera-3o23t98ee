import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { EntregaFutura } from '@/services/notas-fiscais-compra'

// SPEC-220 (reunião Vinicius 21/10): para quem vai o que chegou de uma peça. Lista todas as vendas/L com essa peça
// em ENTREGA FUTURA; o que for vinculado vai para a RESERVA do L ao registrar. Limitador: a soma não passa do que
// chegou e cada L não recebe mais do que espera ("já aconteceu de vincular a mais").

export const lerQtd = (v: string | undefined) => parseFloat((v ?? '').replace(',', '.')) || 0
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/** Sugestão: os L de origem do pedido primeiro (na ordem), depois as outras vendas, até acabar o que chegou. */
export function sugerirVinculos(chegou: number, origens: string[], entregas: EntregaFutura[]) {
  const ordem = [
    ...origens.map((id) => entregas.find((e) => e.projeto_item_id === id)).filter(Boolean),
  ] as EntregaFutura[]
  let resta = chegou
  const r: Record<string, string> = {}
  for (const e of ordem) {
    if (resta <= 0) break
    const q = Math.min(resta, e.q_entrega_futura)
    if (q > 0) {
      r[e.projeto_item_id] = String(Math.round(q * 1000) / 1000)
      resta -= q
    }
  }
  return r
}

export function VinculoClientesDialog({
  aberto,
  onFechar,
  produtoNome,
  chegou,
  entregas,
  valores,
  onSalvar,
}: {
  aberto: boolean
  onFechar: () => void
  produtoNome: string
  chegou: number
  entregas: EntregaFutura[]
  valores: Record<string, string>
  onSalvar: (v: Record<string, string>) => void
}) {
  const [v, setV] = useState<Record<string, string>>(valores)
  useEffect(() => {
    if (aberto) setV(valores)
  }, [aberto, valores])

  const total = Object.values(v).reduce((s, x) => s + lerQtd(x), 0)
  const acimaDoChegou = total > chegou + 0.0001
  const acimaDoL = entregas.some((e) => lerQtd(v[e.projeto_item_id]) > e.q_entrega_futura + 0.0001)
  const negativo = Object.values(v).some((x) => lerQtd(x) < 0)

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Para quem vai — {produtoNome}</DialogTitle>
          <DialogDescription>
            Chegaram {fmt(chegou)}. O que for vinculado sai da entrega futura e vai para a reserva do cliente (L).
            O que sobrar fica livre no estoque.
          </DialogDescription>
        </DialogHeader>
        {entregas.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nenhuma venda espera esta peça em entrega futura.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b">
                <th className="text-left font-medium py-1.5">Venda</th>
                <th className="text-left font-medium py-1.5">Cliente</th>
                <th className="text-left font-medium py-1.5">L</th>
                <th className="text-right font-medium py-1.5">Entrega futura</th>
                <th className="text-right font-medium py-1.5 w-32">Vincular</th>
              </tr>
            </thead>
            <tbody>
              {entregas.map((e) => {
                const q = lerQtd(v[e.projeto_item_id])
                const erro = q > e.q_entrega_futura + 0.0001 || q < 0
                return (
                  <tr key={e.projeto_item_id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5">
                      {e.venda_numero ?? e.orcamento_numero ?? '—'}
                      {e.empresa_nome && <span className="block text-[11px] text-slate-400">{e.empresa_nome}</span>}
                    </td>
                    <td className="py-1.5">
                      {e.cliente_nome}
                      {e.projeto_codigo && (
                        <span className="block text-[11px] text-slate-400">Projeto {e.projeto_codigo}</span>
                      )}
                    </td>
                    <td className="py-1.5 font-mono">{e.l_fixo ?? '—'}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(e.q_entrega_futura)}</td>
                    <td className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5 text-[11px]"
                          title="Vincular o que este L espera (até o que sobra do que chegou)"
                          onClick={() => {
                            const outros = total - q
                            const max = Math.max(0, Math.min(e.q_entrega_futura, chegou - outros))
                            setV({ ...v, [e.projeto_item_id]: String(Math.round(max * 1000) / 1000) })
                          }}
                        >
                          Tudo
                        </Button>
                        <Input
                          inputMode="decimal"
                          className={cn('h-8 w-20 text-right', erro && 'border-red-500 text-red-600')}
                          value={v[e.projeto_item_id] ?? ''}
                          placeholder="0"
                          onChange={(ev) => setV({ ...v, [e.projeto_item_id]: ev.target.value })}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div className={cn('text-sm', acimaDoChegou ? 'text-red-600' : 'text-slate-600')}>
          Vinculado <strong>{fmt(total)}</strong> de {fmt(chegou)}
          {acimaDoChegou
            ? ' — mais do que chegou'
            : chegou - total > 0.0001
              ? ` (${fmt(chegou - total)} ficam livres no estoque)`
              : ''}
          {acimaDoL && <span className="block text-red-600">Um L está recebendo mais do que espera.</span>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setV({})}>
            Limpar
          </Button>
          <Button type="button" variant="outline" onClick={onFechar}>
            Voltar
          </Button>
          <Button
            type="button"
            disabled={acimaDoChegou || acimaDoL || negativo}
            onClick={() => {
              onSalvar(Object.fromEntries(Object.entries(v).filter(([, x]) => lerQtd(x) > 0)))
              onFechar()
            }}
          >
            Confirmar vínculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
