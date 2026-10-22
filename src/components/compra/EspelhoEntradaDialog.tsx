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
import { FileDown, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getEspelhoEntrada, type EspelhoEntrada } from '@/services/notas-fiscais-compra'
import { gerarPdfEspelhoEntrada, nomeArquivoEspelho } from '@/lib/pdf-espelho-entrada'
import { baixarArquivo } from '@/lib/pdf-pedido-fornecedor'

// SPEC-220: espelho da entrada (o que chegou, para quem foi, o que ficou livre e o financeiro), na tela e em PDF
// com nome padrão — o que hoje se salva da Connect e se manda para o Mateus.

const brl = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dia = (v: string | null | undefined) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—')

export function EspelhoEntradaDialog({ notaId, onFechar }: { notaId: string | null; onFechar: () => void }) {
  const { toast } = useToast()
  const [espelho, setEspelho] = useState<EspelhoEntrada | null>(null)
  const [baixando, setBaixando] = useState(false)

  useEffect(() => {
    setEspelho(null)
    if (!notaId) return
    getEspelhoEntrada(notaId)
      .then(setEspelho)
      .catch((err: any) => {
        toast({ title: 'Erro ao abrir o espelho', description: err?.message, variant: 'destructive' })
        onFechar()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaId])

  async function baixar() {
    if (!espelho) return
    setBaixando(true)
    try {
      const bytes = await gerarPdfEspelhoEntrada(espelho)
      baixarArquivo(bytes as BlobPart, 'application/pdf', nomeArquivoEspelho(espelho))
    } catch (err: any) {
      toast({ title: 'Erro ao gerar o PDF', description: err?.message, variant: 'destructive' })
    } finally {
      setBaixando(false)
    }
  }

  const n = espelho?.nota
  return (
    <Dialog open={!!notaId} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Espelho da entrada {n ? `— NF ${n.numero_nf}` : ''}</DialogTitle>
          <DialogDescription>
            {n
              ? `${n.fornecedor_nome ?? ''} · pedido ${n.pedido_numero ?? '—'} · entrada ${dia(n.data_entrada)}${n.cancelada_em ? ' · CANCELADA' : ''}`
              : 'Carregando...'}
          </DialogDescription>
        </DialogHeader>
        {!espelho ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 border-b">
                  <th className="text-left font-medium py-1">Peça</th>
                  <th className="text-left font-medium py-1">Para quem</th>
                  <th className="text-right font-medium py-1">Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {espelho.itens.map((it) => {
                  const vinc = espelho.vinculos.filter((v) => v.produto_id === it.produto_id)
                  const livre = Number(it.quantidade) - vinc.reduce((s, v) => s + Number(v.quantidade), 0)
                  return (
                    <tr key={it.produto_id} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-2">
                        <span className="font-mono text-slate-400 mr-1">{it.codigo}</span>
                        {it.produto}
                        <span className="block text-xs text-slate-500">chegaram {qtd(it.quantidade)}</span>
                      </td>
                      <td className="py-1.5" colSpan={2}>
                        {vinc.map((v, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <span>
                              {v.venda_numero ?? v.orcamento_numero ?? '—'} · {v.cliente_nome ?? '—'} ·{' '}
                              <span className="font-mono">{v.l_fixo ?? '—'}</span>
                            </span>
                            <span className="tabular-nums">{qtd(v.quantidade)}</span>
                          </div>
                        ))}
                        {livre > 0.0001 && (
                          <div className="flex justify-between gap-2 text-slate-500">
                            <span>Livre no estoque</span>
                            <span className="tabular-nums">{qtd(livre)}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-slate-500">Valor da nota</p>
                <p className="font-semibold">{brl(n!.valor)}</p>
              </div>
              <div>
                <p className="text-slate-500">ST</p>
                <p className="font-semibold">{brl(n!.valor_st)}</p>
              </div>
              <div>
                <p className="text-slate-500">Antecipação usada</p>
                <p className="font-semibold">{brl(espelho.antecipacao)}</p>
              </div>
              <div>
                <p className="text-slate-500">Parcelas</p>
                <p className="font-semibold">
                  {espelho.parcelas.length === 0
                    ? '—'
                    : espelho.parcelas.map((p) => `${dia(p.vencimento)} ${brl(p.valor)}`).join(' · ')}
                </p>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
          <Button onClick={baixar} disabled={!espelho || baixando}>
            {baixando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
