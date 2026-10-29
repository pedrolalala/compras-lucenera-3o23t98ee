import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Package, Pencil, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

// SPEC-066 Frente C: observação do fornecedor com edição inline. Saiu do antigo ModalPedidoLote
// (SPEC-209: um só "Fechar pedido").
// SPEC-240: "Itens por caixa" é da peça (produtos.multiplo_compra) e vira regra — a quantidade do
// pedido arredonda para cima até fechar a caixa. Só a Débora e a administração alteram.
export function ObservacaoCaixaFechada({
  observacao,
  itensPorCaixa,
  podeEditarCaixa,
  salvando,
  onSalvar,
}: {
  observacao: string | null
  itensPorCaixa: number
  podeEditarCaixa: boolean
  salvando: boolean
  onSalvar: (observacao: string, itensPorCaixa: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [obs, setObs] = useState('')
  const [qtd, setQtd] = useState('')

  function abrir() {
    setObs(observacao ?? '')
    setQtd(itensPorCaixa > 1 ? String(itensPorCaixa) : '')
    setAberto(true)
  }

  function salvar() {
    onSalvar(obs, qtd)
    setAberto(false)
  }

  const temCaixa = itensPorCaixa > 1
  const temInfo = observacao || temCaixa
  const qtdInvalida = qtd.trim() !== '' && !/^\d+$/.test(qtd.trim())

  return (
    <Popover open={aberto} onOpenChange={(v) => (v ? abrir() : setAberto(false))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'mt-1 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors',
            temInfo
              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
          )}
        >
          {temCaixa ? (
            <Package className="w-3 h-3" />
          ) : temInfo ? (
            <StickyNote className="w-3 h-3" />
          ) : (
            <Pencil className="w-3 h-3" />
          )}
          {temInfo
            ? [temCaixa ? `Caixa: ${itensPorCaixa}` : null, observacao].filter(Boolean).join(' · ')
            : 'Caixa / observação'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <Label className="text-xs">Itens por caixa (caixa fechada)</Label>
          <Input
            type="number"
            min="1"
            step="1"
            className="h-8 text-sm"
            value={qtd}
            disabled={!podeEditarCaixa}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="ex: 10"
          />
          <p className="text-[11px] text-slate-500">
            {podeEditarCaixa
              ? 'Vale para todas as compras desta peça: precisa de 38 e a caixa é 10 → compra 40. Vazio = sem regra.'
              : 'Só a Débora e a administração alteram.'}
          </p>
          {qtdInvalida && <p className="text-[11px] text-red-600">Use um número inteiro.</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Observação</Label>
          <Textarea
            className="text-sm resize-none"
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="ex: fornecedor só fatura acima de R$ 500"
          />
        </div>
        <Button size="sm" className="w-full h-8" onClick={salvar} disabled={salvando || qtdInvalida}>
          {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Salvar
        </Button>
      </PopoverContent>
    </Popover>
  )
}
