import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Pencil, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

// SPEC-066 Frente C: "caixa fechada" (observação/qtd mínima de produto_fornecedores) com edição
// inline. Único lugar do sistema onde essa informação aparece e é editável, por decisão explícita
// da Débora (não na grid principal de Necessidade de Compra). Saiu do antigo ModalPedidoLote
// (SPEC-209: um só "Fechar pedido").
export function ObservacaoCaixaFechada({
  observacao,
  qtdMinima,
  salvando,
  onSalvar,
}: {
  observacao: string | null
  qtdMinima: number | null
  salvando: boolean
  onSalvar: (observacao: string, qtdMinima: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [obs, setObs] = useState('')
  const [qtd, setQtd] = useState('')

  function abrir() {
    setObs(observacao ?? '')
    setQtd(qtdMinima != null ? String(qtdMinima) : '')
    setAberto(true)
  }

  function salvar() {
    onSalvar(obs, qtd)
    setAberto(false)
  }

  const temInfo = observacao || qtdMinima != null

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
          {temInfo ? <StickyNote className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {temInfo ? observacao || `Caixa fechada: ${qtdMinima}` : 'Adicionar observação'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <Label className="text-xs">Quantidade mínima (caixa fechada)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-sm"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="ex: 12"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Observação</Label>
          <Textarea
            className="text-sm resize-none"
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="ex: só vende em caixa fechada de 12 unidades"
          />
        </div>
        <Button size="sm" className="w-full h-8" onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Salvar
        </Button>
      </PopoverContent>
    </Popover>
  )
}
