import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Sparkles } from 'lucide-react'

// SPEC-034: modal de revisão em lote das sugestões de fornecedor por marca
// (só candidatos de alta confiança, score >= LIMIAR_SUGESTAO_FORTE, filtrado
// em Marcas.tsx antes de passar a prop `sugestoes`). Nunca aplica nada
// sozinho — exige o passo explícito de revisão/confirmação aqui, mesmo para
// candidatos de alta confiança (decisão da SPEC-030/034: casar por nome
// nunca é aplicado sem confirmação humana).

export interface SugestaoRevisao {
  marcaId: string
  marcaNome: string
  fornecedorId: string
  fornecedorNome: string
  score: number
}

interface ModalRevisarSugestoesFornecedorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sugestoes: SugestaoRevisao[]
  onConfirmar: (selecionadas: string[]) => Promise<void>
}

export function ModalRevisarSugestoesFornecedor({
  open,
  onOpenChange,
  sugestoes,
  onConfirmar,
}: ModalRevisarSugestoesFornecedorProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // Todas marcadas por padrão sempre que o modal abre com uma nova lista.
  useEffect(() => {
    if (!open) return
    setSelecionadas(new Set(sugestoes.map((s) => s.marcaId)))
  }, [open, sugestoes])

  function toggleLinha(marcaId: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(marcaId)) {
        next.delete(marcaId)
      } else {
        next.add(marcaId)
      }
      return next
    })
  }

  function toggleTodas() {
    setSelecionadas((prev) =>
      prev.size === sugestoes.length ? new Set() : new Set(sugestoes.map((s) => s.marcaId)),
    )
  }

  async function handleConfirmar() {
    if (selecionadas.size === 0 || loading) return
    setLoading(true)
    try {
      await onConfirmar(Array.from(selecionadas))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Revisar sugestões fortes de fornecedor
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-500 -mt-1">
          Confira cada vínculo sugerido antes de confirmar. Desmarque as linhas que não devem ser
          aplicadas.
        </p>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[8%]">
                  <Checkbox
                    checked={sugestoes.length > 0 && selecionadas.size === sugestoes.length}
                    onCheckedChange={toggleTodas}
                    disabled={loading}
                    aria-label="Selecionar todas"
                  />
                </TableHead>
                <TableHead className="text-xs">Marca</TableHead>
                <TableHead className="text-xs">Fornecedor sugerido</TableHead>
                <TableHead className="text-xs w-[80px] text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sugestoes.map((s) => (
                <TableRow
                  key={s.marcaId}
                  className="cursor-pointer"
                  onClick={() => !loading && toggleLinha(s.marcaId)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selecionadas.has(s.marcaId)}
                      onCheckedChange={() => toggleLinha(s.marcaId)}
                      disabled={loading}
                      aria-label={`Selecionar ${s.marcaNome}`}
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {s.marcaNome}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{s.fornecedorNome}</TableCell>
                  <TableCell className="text-sm text-right text-emerald-700 font-semibold tabular-nums">
                    {Math.round(s.score * 100)}%
                  </TableCell>
                </TableRow>
              ))}
              {sugestoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-slate-400 py-8">
                    Nenhuma sugestão forte pendente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="pt-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-11"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={selecionadas.size === 0 || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px] h-11"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              `Confirmar ${selecionadas.size} vínculo(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
