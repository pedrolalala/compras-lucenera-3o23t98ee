import { useState, useEffect, useCallback } from 'react'
import { Loader2, Wallet, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/hooks/use-toast'
import {
  getParcelasPedidoCompra,
  gerarParcelasPedidoCompra,
  atualizarParcelaPedidoCompra,
  type PedidoCompraParcela,
} from '@/services/pedido-compra'

interface Props {
  pedidoId: string
  pedidoNumero: string
  condicoesPagamento: string | null
  valorTotal: number | null
}

interface EdicaoParcela {
  id: string
  valor: string
  data: string
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PedidoParcelasPanel({
  pedidoId,
  pedidoNumero,
  condicoesPagamento,
  valorTotal,
}: Props) {
  const { toast } = useToast()
  const [parcelas, setParcelas] = useState<PedidoCompraParcela[]>([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [edicao, setEdicao] = useState<EdicaoParcela | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getParcelasPedidoCompra(pedidoId)
      setParcelas(data)
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar parcelas.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [pedidoId, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleGerar() {
    setGerando(true)
    try {
      await gerarParcelasPedidoCompra(pedidoId)
      toast({ title: 'Parcelas geradas', description: `Pedido #${pedidoNumero}.` })
      await carregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar parcelas',
        description:
          err?.message ??
          'Verifique se "Condições de pagamento" está preenchido de forma interpretável (ex: 30/60/90 dias).',
        variant: 'destructive',
      })
    } finally {
      setGerando(false)
    }
  }

  function iniciarEdicao(p: PedidoCompraParcela) {
    setEdicao({ id: p.id, valor: String(p.valor), data: p.data_vencimento })
  }

  async function salvarEdicao() {
    if (!edicao) return
    const valor = parseFloat(edicao.valor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Digite um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }
    if (!edicao.data) {
      toast({
        title: 'Data inválida',
        description: 'Selecione uma data de vencimento.',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      await atualizarParcelaPedidoCompra(edicao.id, valor, edicao.data)
      toast({ title: 'Parcela atualizada' })
      setEdicao(null)
      await carregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar parcela',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0)
  const divergeDoTotal = valorTotal != null && Math.abs(somaParcelas - valorTotal) > 0.01

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Carregando parcelas...</span>
      </div>
    )
  }

  if (parcelas.length === 0) {
    return (
      <div className="bg-slate-50/70 border-b border-slate-100 py-4 px-6 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {condicoesPagamento
            ? `Nenhuma parcela gerada ainda para "${condicoesPagamento}".`
            : 'Nenhuma parcela gerada. Preencha "Condições de pagamento" no pedido para gerar automaticamente.'}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs shrink-0"
          disabled={gerando || !condicoesPagamento}
          onClick={handleGerar}
        >
          {gerando ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Wallet className="w-3.5 h-3.5 mr-1.5" />
          )}
          Gerar parcelas
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-slate-50/70 border-b border-slate-100 px-6 py-3">
      <Table>
        <TableHeader>
          <TableRow className="h-8 hover:bg-transparent">
            <TableHead className="text-[10px] uppercase text-slate-500">Parcela</TableHead>
            <TableHead className="text-[10px] uppercase text-slate-500 text-right">Valor</TableHead>
            <TableHead className="text-[10px] uppercase text-slate-500 text-right">
              Vencimento
            </TableHead>
            <TableHead className="text-[10px] uppercase text-slate-500 text-right">
              Status
            </TableHead>
            <TableHead className="text-[10px] uppercase text-slate-500 text-right w-[90px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {parcelas.map((p) => {
            const isEditing = edicao?.id === p.id
            return (
              <TableRow key={p.id} className="h-10">
                <TableCell className="text-xs text-slate-600">{p.numero_parcela}</TableCell>
                <TableCell className="text-right text-xs">
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="h-7 w-24 text-xs text-right ml-auto"
                      value={edicao!.valor}
                      onChange={(e) =>
                        setEdicao((prev) => (prev ? { ...prev, valor: e.target.value } : null))
                      }
                      disabled={salvando}
                    />
                  ) : (
                    <span className="font-medium text-slate-700">{fmtBRL(p.valor)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {isEditing ? (
                    <Input
                      type="date"
                      className="h-7 w-36 text-xs text-right ml-auto"
                      value={edicao!.data}
                      onChange={(e) =>
                        setEdicao((prev) => (prev ? { ...prev, data: e.target.value } : null))
                      }
                      disabled={salvando}
                    />
                  ) : (
                    <span className="text-slate-600">
                      {new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={salvando}
                        onClick={() => setEdicao(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                        disabled={salvando}
                        onClick={salvarEdicao}
                      >
                        {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => iniciarEdicao(p)}
                    >
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter className="bg-transparent">
          <TableRow className="h-8 hover:bg-transparent">
            <TableCell colSpan={5} className="text-right text-[11px] py-1">
              <span className="text-slate-500">Soma das parcelas: </span>
              <span
                className={
                  divergeDoTotal ? 'font-semibold text-red-600' : 'font-semibold text-slate-700'
                }
              >
                {fmtBRL(somaParcelas)}
              </span>
              {valorTotal != null && (
                <span className="text-slate-400">
                  {' '}
                  {' / '}
                  {fmtBRL(valorTotal)} do pedido
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 ml-2 text-[11px]"
                onClick={carregar}
                title="Recarregar parcelas"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
