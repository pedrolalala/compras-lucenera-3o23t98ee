import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  registrarDevolucaoPorSetor,
  type DevolucaoSaldoItemRow,
  type SetorOrigemDevolucao,
} from '@/services/devolucoes'

// SPEC-054 — Interface de Devolução de Estoque (linhas manuais por setor de
// origem). Modelado sobre o padrão de lançamento em múltiplas linhas já
// usado em ModalGerarCompraItemOrcamento.tsx, mas para UM item por vez
// (o usuário abre o modal a partir da linha do item na lista): cada linha
// aqui é uma devolução independente (setor_origem + quantidade + motivo),
// e ao confirmar dispara uma chamada de registrarDevolucaoPorSetor POR
// LINHA — não é uma transação atômica entre linhas (decisão da SPEC).

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: DevolucaoSaldoItemRow | null
  onSuccess: () => void
}

interface LinhaDevolucao {
  id: string
  setor: SetorOrigemDevolucao | ''
  quantidade: string
  motivo: string
}

const SETOR_LABEL: Record<SetorOrigemDevolucao, string> = {
  entrega_futura: 'Entrega Futura',
  reserva: 'Reserva',
  entregue: 'Entregue',
}

let linhaSeq = 0
function novaLinha(): LinhaDevolucao {
  linhaSeq += 1
  return { id: `linha-${linhaSeq}`, setor: '', quantidade: '', motivo: '' }
}

export function ModalDevolucaoItem({ open, onOpenChange, item, onSuccess }: Props) {
  const { toast } = useToast()
  const [linhas, setLinhas] = useState<LinhaDevolucao[]>([novaLinha()])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLinhas([novaLinha()])
  }, [open, item?.projeto_item_id])

  if (!item) return null

  const saldoPorSetor: Record<SetorOrigemDevolucao, number> = {
    entrega_futura: item.q_entrega_futura,
    reserva: item.q_reserva,
    entregue: item.q_entregue,
  }

  // Soma das quantidades lançadas nesta sessão, por setor — usada para
  // validar que nenhum setor ultrapassa o próprio saldo (P-requisito da
  // SPEC: validação client-side antes de enviar).
  const usadoPorSetor: Record<SetorOrigemDevolucao, number> = {
    entrega_futura: 0,
    reserva: 0,
    entregue: 0,
  }
  for (const l of linhas) {
    if (!l.setor) continue
    const qtd = parseFloat(l.quantidade)
    if (Number.isFinite(qtd) && qtd > 0) usadoPorSetor[l.setor] += qtd
  }

  const setoresEstourados = (Object.keys(usadoPorSetor) as SetorOrigemDevolucao[]).filter(
    (s) => usadoPorSetor[s] > saldoPorSetor[s],
  )

  const linhasValidas = linhas.filter((l) => {
    const qtd = parseFloat(l.quantidade)
    return l.setor !== '' && Number.isFinite(qtd) && qtd > 0
  })

  const canSubmit =
    !loading &&
    linhasValidas.length > 0 &&
    linhasValidas.length === linhas.length &&
    setoresEstourados.length === 0

  function atualizarLinha(id: string, campo: keyof LinhaDevolucao, valor: string) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, novaLinha()])
  }

  function removerLinha(id: string) {
    setLinhas((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !item) return
    setLoading(true)

    const pendentes = [...linhasValidas]
    const falhas: LinhaDevolucao[] = []
    let sucessos = 0

    for (const linha of pendentes) {
      try {
        await registrarDevolucaoPorSetor(
          item.projeto_item_id,
          linha.setor as SetorOrigemDevolucao,
          parseFloat(linha.quantidade),
          linha.motivo,
        )
        sucessos += 1
      } catch (err: any) {
        falhas.push(linha)
        toast({
          title: `Falha na linha (${SETOR_LABEL[linha.setor as SetorOrigemDevolucao]})`,
          description: err?.message ?? 'Erro desconhecido ao registrar devolução.',
          variant: 'destructive',
        })
      }
    }

    setLoading(false)

    if (sucessos > 0) {
      toast({
        title: 'Devolução registrada',
        description: `${sucessos} linha(s) de devolução registrada(s) para ${item.produto}.`,
      })
      onSuccess()
    }

    if (falhas.length > 0) {
      // Mantém o modal aberto só com as linhas que falharam, para o usuário
      // corrigir sem perder o que já deu certo.
      setLinhas(falhas)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            Devolução de Estoque — {item.produto}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <SaldoCard label="Entrega Futura" valor={item.q_entrega_futura} />
          <SaldoCard label="Reserva" valor={item.q_reserva} />
          <SaldoCard label="Entregue" valor={item.q_entregue} />
        </div>

        <p className="text-xs text-slate-500">
          {item.orcamento_numero ? `Orçamento ${item.orcamento_numero}` : 'Sem orçamento vinculado'}
          {item.projeto_codigo ? ` · Projeto ${item.projeto_codigo}` : ''}
          {item.produto_codigo != null ? ` · Código ${item.produto_codigo}` : ''}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs w-[180px]">Setor de Origem</TableHead>
                  <TableHead className="text-xs w-[110px] text-right">Quantidade</TableHead>
                  <TableHead className="text-xs">Motivo (opcional)</TableHead>
                  <TableHead className="text-xs w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const saldoSetor = l.setor ? saldoPorSetor[l.setor] : null
                  const estourou = l.setor && setoresEstourados.includes(l.setor)
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Select
                          value={l.setor}
                          onValueChange={(v) => atualizarLinha(l.id, 'setor', v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(SETOR_LABEL) as SetorOrigemDevolucao[]).map((s) => (
                              <SelectItem key={s} value={s} disabled={saldoPorSetor[s] <= 0}>
                                {SETOR_LABEL[s]} (saldo {saldoPorSetor[s]})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          max={saldoSetor ?? undefined}
                          className={cn('h-9 text-sm text-right', estourou && 'border-red-400')}
                          value={l.quantidade}
                          onChange={(e) => atualizarLinha(l.id, 'quantidade', e.target.value)}
                          disabled={!l.setor}
                        />
                        {estourou && (
                          <p className="text-[11px] text-red-600 mt-1">
                            Soma do setor ({usadoPorSetor[l.setor as SetorOrigemDevolucao]}) excede
                            o saldo ({saldoSetor}).
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Motivo da devolução..."
                          className="h-9 text-sm"
                          value={l.motivo}
                          onChange={(e) => atualizarLinha(l.id, 'motivo', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => removerLinha(l.id)}
                          disabled={linhas.length === 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarLinha}
            className="h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adicionar linha
          </Button>

          <p className="text-xs text-slate-500">
            Cada linha gera uma devolução independente. Devoluções de Reserva ou Entregue entram no
            estoque físico; devolução de Entrega Futura só reduz a necessidade de compra (virtual,
            sem entrada física). Entregue nunca diminui — fica registrado como histórico.
          </p>

          <DialogFooter className="pt-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11"
            >
              Fechar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white min-w-[180px] h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Confirmar Devolução
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SaldoCard({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="text-lg font-bold text-slate-800">{valor}</p>
    </div>
  )
}
