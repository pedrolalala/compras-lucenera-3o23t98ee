import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { lerNumero } from '@/components/compra/custo-compra'
import {
  ajustarImpostosMarca,
  type MarcaComFornecedor,
  type PreviaImpostosMarca,
} from '@/services/marcas'

// SPEC-263 A: mudança tributária — troca o ST e/ou o IPI de todas as peças da marca de uma vez. Sempre mostra
// a prévia (quantas peças, antes e depois) e só grava depois da confirmação.

const pct = (n: number | null | undefined) =>
  n == null ? '—' : `${String(n).replace('.', ',')}%`

export function AjustarImpostosMarcaDialog({
  marca,
  onOpenChange,
}: {
  marca: MarcaComFornecedor | null
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [st, setSt] = useState('')
  const [ipi, setIpi] = useState('')
  const [somenteComImposto, setSomenteComImposto] = useState(true)
  const [previa, setPrevia] = useState<PreviaImpostosMarca | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    setSt('')
    setIpi('')
    setSomenteComImposto(true)
    setPrevia(null)
  }, [marca?.id])

  // qualquer mudança nos campos invalida a prévia: grava só o que foi mostrado
  function mudou() {
    setPrevia(null)
  }

  const stNum = st.trim() ? lerNumero(st) : null
  const ipiNum = ipi.trim() ? lerNumero(ipi) : null
  const invalido =
    (stNum == null && ipiNum == null) ||
    (stNum != null && (stNum < 0 || stNum > 100)) ||
    (ipiNum != null && (ipiNum < 0 || ipiNum > 100))

  async function rodar(aplicar: boolean) {
    if (!marca || invalido) return
    setCarregando(true)
    try {
      const r = await ajustarImpostosMarca({
        marcaId: marca.id,
        st: stNum,
        ipi: ipiNum,
        somenteComImposto,
        aplicar,
      })
      if (!aplicar) {
        setPrevia(r)
        return
      }
      toast({
        title: `Impostos da marca ${r.marca} atualizados`,
        description: `${r.gravados} peça(s) alteradas.`,
      })
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: aplicar ? 'Não foi possível aplicar' : 'Não foi possível calcular',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Dialog open={marca != null} onOpenChange={(o) => !carregando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar ST e IPI — {marca?.nome}</DialogTitle>
          <p className="text-xs text-slate-500">
            Muda o percentual em todas as peças da marca de uma vez (mudança tributária). Deixe em branco o
            imposto que não quer mexer. Antes de gravar você vê quantas peças mudam.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Novo ST (%)</Label>
              <Input
                inputMode="decimal"
                placeholder="não mexer"
                className="h-9 text-right"
                value={st}
                onChange={(e) => {
                  setSt(e.target.value)
                  mudou()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Novo IPI (%)</Label>
              <Input
                inputMode="decimal"
                placeholder="não mexer"
                className="h-9 text-right"
                value={ipi}
                onChange={(e) => {
                  setIpi(e.target.value)
                  mudou()
                }}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <Checkbox
              checked={somenteComImposto}
              onCheckedChange={(v) => {
                setSomenteComImposto(v === true)
                mudou()
              }}
              className="mt-0.5"
            />
            <span>
              Só nas peças que <b>já têm</b> esse imposto (recomendado)
              <span className="block text-xs text-slate-500">
                Desmarcado, o percentual vai para todas as peças da marca, inclusive as que hoje não têm ST/IPI.
              </span>
            </span>
          </label>

          {previa && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
              <p>
                <b>{previa.produtos_afetados}</b> peça(s) da marca {previa.marca} vão mudar
                {' '}({previa.total_produtos} no total, {previa.produtos_ativos} ativas)
                {stNum != null && <> · ST em {previa.alvo_st}</>}
                {ipiNum != null && <> · IPI em {previa.alvo_ipi}</>}.
              </p>
              {previa.preco_venda_recalculado > 0 && (
                <p className="text-xs text-amber-700">
                  {previa.preco_venda_recalculado} dessas peças não têm valor de venda da Connect: o preço de venda delas
                  é recalculado (custo total × 2,5).
                </p>
              )}
              {previa.produtos_afetados === 0 ? (
                <p className="text-slate-500">Nada a alterar com essas regras.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1 pr-2 font-medium">Peça</th>
                        <th className="py-1 px-2 font-medium text-right">ST</th>
                        <th className="py-1 pl-2 font-medium text-right">IPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.amostra.map((a, i) => (
                        <tr key={i} className="border-t border-slate-200">
                          <td className="py-1 pr-2">
                            <span className="font-mono text-slate-400 mr-1">{a.codigo}</span>
                            <span className="line-clamp-1">{a.nome}</span>
                          </td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">
                            {pct(a.st_antes)} → <b>{pct(a.st_depois)}</b>
                          </td>
                          <td className="py-1 pl-2 text-right whitespace-nowrap">
                            {pct(a.ipi_antes)} → <b>{pct(a.ipi_depois)}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previa.produtos_afetados > previa.amostra.length && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mostrando {previa.amostra.length} de {previa.produtos_afetados}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={carregando}>
            Cancelar
          </Button>
          {!previa ? (
            <Button onClick={() => rodar(false)} disabled={invalido || carregando}>
              {carregando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ver o que muda
            </Button>
          ) : (
            <Button
              onClick={() => rodar(true)}
              disabled={carregando || previa.produtos_afetados === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {carregando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aplicar em {previa.produtos_afetados} peça(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
