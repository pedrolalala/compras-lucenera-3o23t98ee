import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import {
  buscarProjetosParaReserva,
  type ProjetoReserva,
  type ReservaEscolhida,
} from '@/services/reserva-projeto'

// SPEC-299: "Reservar para projeto" — a compra é adiantada para uma venda fechada que ainda não passou.
// Quantidade exata por projeto; a soma não passa da quantidade do item. Quem tem a peça no orçamento vem primeiro.

const lerQtd = (v: string | undefined) => parseFloat((v ?? '').replace(',', '.')) || 0
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function ReservaProjetoDialog({
  aberto,
  onFechar,
  produtoId,
  produtoNome,
  quantidadeItem,
  valores,
  onSalvar,
}: {
  aberto: boolean
  onFechar: () => void
  produtoId: string
  produtoNome: string
  quantidadeItem: number
  valores: ReservaEscolhida[]
  onSalvar: (r: ReservaEscolhida[]) => void
}) {
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<ProjetoReserva[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [escolhidos, setEscolhidos] = useState<ReservaEscolhida[]>([])
  const [qtds, setQtds] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!aberto) return
    setEscolhidos(valores)
    setQtds(Object.fromEntries(valores.map((v) => [v.projeto_id, String(v.quantidade)])))
    setBusca('')
    setErro('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const t = setTimeout(async () => {
      setCarregando(true)
      try {
        setAchados(await buscarProjetosParaReserva(busca, produtoId))
        setErro('')
      } catch (e: any) {
        setAchados([])
        setErro(e?.message ?? 'Erro na busca de projetos.')
      } finally {
        setCarregando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [aberto, busca, produtoId])

  const soma = escolhidos.reduce((s, e) => s + lerQtd(qtds[e.projeto_id]), 0)
  const passou = soma > quantidadeItem + 1e-9
  const invalido = escolhidos.some((e) => lerQtd(qtds[e.projeto_id]) <= 0)

  function alternar(p: ProjetoReserva) {
    setEscolhidos((prev) => {
      if (prev.some((e) => e.projeto_id === p.projeto_id)) return prev.filter((e) => e.projeto_id !== p.projeto_id)
      const resta = Math.max(quantidadeItem - prev.reduce((s, e) => s + lerQtd(qtds[e.projeto_id]), 0), 0)
      const sugestao = p.qtd_da_peca > 0 ? Math.min(p.qtd_da_peca, resta || p.qtd_da_peca) : resta || 1
      setQtds((q) => ({ ...q, [p.projeto_id]: String(sugestao) }))
      return [
        ...prev,
        {
          projeto_id: p.projeto_id,
          projeto_codigo: p.projeto_codigo,
          projeto_nome: p.projeto_nome,
          cliente_nome: p.cliente_nome,
          quantidade: sugestao,
        },
      ]
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservar para projeto</DialogTitle>
          <DialogDescription>
            {produtoNome} — pedido de {fmt(quantidadeItem)} un. A quantidade reservada fica "do projeto": não cobre a
            necessidade de outras vendas e vem sugerida para ele na entrada da nota.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar pelo código do projeto, nome ou cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {erro && <p className="text-xs text-red-600">{erro}</p>}

        <div className="max-h-[280px] overflow-auto rounded-md border border-slate-200 divide-y divide-slate-100">
          {carregando ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : achados.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhum projeto com orçamento em andamento.</p>
          ) : (
            achados.map((p) => {
              const marcado = escolhidos.some((e) => e.projeto_id === p.projeto_id)
              return (
                <button
                  key={p.projeto_id}
                  type="button"
                  onClick={() => alternar(p)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-start gap-2',
                    marcado && 'bg-emerald-50',
                  )}
                >
                  <input type="checkbox" readOnly checked={marcado} className="mt-1" />
                  <span className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-slate-500 mr-1.5">{p.projeto_codigo}</span>
                    {p.projeto_nome}
                    <span className="block text-[11px] text-slate-500">
                      {p.cliente_nome}
                      {p.orcamento_numero ? ` · orçamento ${p.orcamento_numero}` : ''}
                      {p.orcamento_status ? ` (${p.orcamento_status})` : ''}
                    </span>
                  </span>
                  {p.tem_a_peca && (
                    <span className="text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                      tem esta peça ({fmt(p.qtd_da_peca)})
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {escolhidos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Quantidade reservada por projeto</p>
            {escolhidos.map((e) => (
              <div key={e.projeto_id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-mono text-xs text-slate-500 mr-1.5">{e.projeto_codigo}</span>
                  {e.cliente_nome}
                </span>
                <Input
                  inputMode="decimal"
                  className={cn('h-8 w-24 text-right', lerQtd(qtds[e.projeto_id]) <= 0 && 'border-red-400')}
                  value={qtds[e.projeto_id] ?? ''}
                  onChange={(ev) => setQtds((q) => ({ ...q, [e.projeto_id]: ev.target.value }))}
                />
              </div>
            ))}
            <p className={cn('text-xs', passou ? 'text-red-600 font-medium' : 'text-slate-500')}>
              Reservado {fmt(soma)} de {fmt(quantidadeItem)} un.
              {passou ? ' — passa da quantidade do pedido.' : ''}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          {valores.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                onSalvar([])
                onFechar()
              }}
            >
              Tirar reserva
            </Button>
          )}
          <Button
            disabled={passou || invalido}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              onSalvar(escolhidos.map((e) => ({ ...e, quantidade: lerQtd(qtds[e.projeto_id]) })))
              onFechar()
            }}
          >
            Reservar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
