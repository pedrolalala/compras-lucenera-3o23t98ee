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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  perguntaPagamentoPedido,
  responderPagamentoPedido,
  type PerguntaPagamentoPedido,
} from '@/services/pedido-pago-pergunta'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDia(v: string) {
  const [a, m, d] = v.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : '—'
}
function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  /** Pedido concluído a perguntar; null = fechado. */
  pedido: { id: string; numero: string; fornecedor_nome?: string | null } | null
  /** Chamado ao responder (Sim ou Não) ou quando o banco diz que não há mais o que perguntar. */
  onRespondido: (pedidoId: string) => void
  /** "Responder depois": fecha sem responder (a pergunta volta na próxima vez). */
  onAdiar: (pedidoId: string) => void
}

/** SPEC-258 4b: ao concluir um pedido, o Compras diz se as parcelas já foram pagas.
 *  Sim = o Financeiro recebe as baixas (e completa a conta bancária); Não = as parcelas seguem previstas no Contas a Pagar. */
export function PedidoPagoPerguntaDialog({ pedido, onRespondido, onAdiar }: Props) {
  const { toast } = useToast()
  const [dados, setDados] = useState<PerguntaPagamentoPedido | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [modoSim, setModoSim] = useState(false)
  const [data, setData] = useState(hojeISO())
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!pedido) {
      setDados(null)
      return
    }
    let ativo = true
    setDados(null)
    setModoSim(false)
    setData(hojeISO())
    setObs('')
    setCarregando(true)
    perguntaPagamentoPedido(pedido.id)
      .then((r) => {
        if (!ativo) return
        if (!r.perguntar) onRespondido(pedido.id)
        else setDados(r)
      })
      .catch((err: any) => {
        if (!ativo) return
        toast({
          title: 'Não foi possível carregar a pergunta de pagamento',
          description: err?.message,
          variant: 'destructive',
        })
        onAdiar(pedido.id)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.id])

  async function responder(pagas: boolean) {
    if (!pedido) return
    if (pagas && !data) {
      toast({ title: 'Informe a data do pagamento', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const n = await responderPagamentoPedido(pedido.id, pagas, data, obs)
      toast({
        title: pagas ? 'Pagamento informado ao Financeiro' : 'Parcelas seguem a pagar',
        description: pagas
          ? `${n} parcela(s) do pedido ${pedido.numero} marcadas como pagas. O Financeiro completa a conta bancária.`
          : `As parcelas do pedido ${pedido.numero} continuam previstas no Contas a Pagar.`,
      })
      onRespondido(pedido.id)
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar a resposta',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const total = (dados?.parcelas_previstas ?? []).reduce((s, p) => s + Number(p.valor), 0)

  return (
    <Dialog
      open={!!pedido && (carregando || !!dados)}
      onOpenChange={(o) => {
        if (!o && !salvando && pedido) onAdiar(pedido.id)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>As parcelas deste pedido já foram pagas?</DialogTitle>
          <DialogDescription>
            Pedido {pedido?.numero}
            {pedido?.fornecedor_nome ? ` — ${pedido.fornecedor_nome}` : ''}. Está concluído, mas estas parcelas
            ainda constam como previstas no Contas a Pagar.
          </DialogDescription>
        </DialogHeader>

        {carregando && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}

        {dados && (
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 divide-y text-sm">
              {dados.parcelas_previstas.map((p) => (
                <div key={`${p.numero}-${p.vencimento}`} className="flex justify-between px-3 py-1.5">
                  <span>
                    Parcela {p.numero} · vence {fmtDia(p.vencimento)}
                  </span>
                  <span className="font-medium">{fmtBRL(Number(p.valor))}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-1.5 bg-slate-50 font-semibold">
                <span>Total previsto</span>
                <span>{fmtBRL(total)}</span>
              </div>
            </div>

            {modoSim && (
              <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="space-y-1">
                  <Label htmlFor="pago-data">Data do pagamento</Label>
                  <Input
                    id="pago-data"
                    type="date"
                    value={data}
                    max={hojeISO()}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pago-obs">Observação (opcional)</Label>
                  <Textarea
                    id="pago-obs"
                    rows={2}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex.: pago à vista no Pix"
                  />
                </div>
                <p className="text-xs text-slate-500">A conta bancária o Financeiro completa depois.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" disabled={salvando} onClick={() => pedido && onAdiar(pedido.id)}>
            Responder depois
          </Button>
          {dados && !modoSim && (
            <>
              <Button variant="outline" disabled={salvando} onClick={() => responder(false)}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Não, ainda não foram pagas
              </Button>
              <Button disabled={salvando} onClick={() => setModoSim(true)}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Sim, já foram pagas
              </Button>
            </>
          )}
          {dados && modoSim && (
            <>
              <Button variant="outline" disabled={salvando} onClick={() => setModoSim(false)}>
                Voltar
              </Button>
              <Button disabled={salvando} onClick={() => responder(true)}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirmar pagamento
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
