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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Loader2, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  editarPedidoCompra,
  getEmpresas,
  getItensDoPedido,
  type Empresa,
  type PedidoCompraRow,
} from '@/services/pedido-compra'
import {
  CampoPercentual,
  TotaisCompra,
  brl,
  calcularCustoItem,
  lerNumero,
} from '@/components/compra/custo-compra'
import { useArrastavel } from '@/components/compra/use-arrastavel'

// SPEC-209 D3: o fornecedor respondeu (mudou quantidade, deu desconto, faltou item...) e a Débora
// ajusta o pedido antes de aprovar. Só vale para "Aguardando aprovar" (o banco também barra).

interface LinhaEdicao {
  id: string
  produto: string
  codigo: string | null
  quantidade: string
  custoLiquido: string
  stPerc: string
  ipiPerc: string
  outrasPerc: string
  remover: boolean
}

function percentualDoValor(valor: number | null, base: number): string {
  if (valor == null || !base) return ''
  const p = Math.round((valor / base) * 100 * 100) / 100
  return p ? String(p).replace('.', ',') : ''
}

export function EditarPedidoDialog({
  pedido,
  onOpenChange,
  onSalvo,
}: {
  pedido: PedidoCompraRow | null
  onOpenChange: (open: boolean) => void
  onSalvo: () => void
}) {
  const { toast } = useToast()
  const arrastar = useArrastavel(pedido?.id)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [desconto, setDesconto] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [condicoes, setCondicoes] = useState('')
  const [localEntrega, setLocalEntrega] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    if (!pedido) return
    setEmpresaId(pedido.empresa_id ?? '')
    setDesconto(pedido.desconto_percentual ? String(pedido.desconto_percentual) : '')
    setDataPrevista(pedido.data_prevista_entrega ?? '')
    setCondicoes(pedido.condicoes_pagamento ?? '')
    setLocalEntrega(pedido.local_entrega ?? '')
    setObservacao(pedido.observacao ?? '')
    getEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
    setCarregando(true)
    getItensDoPedido(pedido.id)
      .then((itens) =>
        setLinhas(
          itens.map((i) => {
            const base = i.custo_liquido ?? i.custo_unitario
            return {
              id: i.id,
              produto: i.produto_nome,
              codigo: i.produto_codigo,
              quantidade: String(i.quantidade),
              custoLiquido: String(base),
              stPerc: percentualDoValor(i.valor_st, base),
              ipiPerc: percentualDoValor(i.valor_ipi, base),
              outrasPerc: percentualDoValor(i.valor_outras_despesas, base),
              remover: false,
            }
          }),
        ),
      )
      .catch((err) =>
        toast({
          title: 'Erro ao carregar itens do pedido',
          description: err?.message,
          variant: 'destructive',
        }),
      )
      .finally(() => setCarregando(false))
  }, [pedido, toast])

  function mudar(id: string, campo: keyof LinhaEdicao, valor: string | boolean) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
  }

  const calculadas = linhas.map((l) => {
    const custo = lerNumero(l.custoLiquido)
    return { ...l, qtd: lerNumero(l.quantidade), custo, c: calcularCustoItem(custo, l) }
  })
  const ativas = calculadas.filter((l) => !l.remover)
  const totalProdutos = ativas.reduce((s, l) => s + l.qtd * l.custo, 0)
  const totalComImpostos = ativas.reduce((s, l) => s + l.qtd * l.c.total, 0)
  const descontoNum = Math.min(100, Math.max(0, lerNumero(desconto)))
  const valido = ativas.length > 0 && ativas.every((l) => l.qtd > 0 && l.c.total > 0)

  async function salvar() {
    if (!pedido || !valido) return
    setSalvando(true)
    try {
      const r = await editarPedidoCompra({
        pedido_id: pedido.id,
        itens: calculadas.map((l) =>
          l.remover
            ? { pedido_item_id: l.id, remover: true }
            : {
                pedido_item_id: l.id,
                quantidade: l.qtd,
                custo_unitario: l.c.total,
                custo_liquido: l.custo || null,
                valor_ipi: l.c.ipi || null,
                valor_st: l.c.st || null,
                valor_outras_despesas: l.c.outras || null,
              },
        ),
        data_prevista_entrega: dataPrevista || null,
        condicoes_pagamento: condicoes,
        observacao,
        desconto_percentual: descontoNum || null,
        empresa_id: empresaId || null,
        local_entrega: localEntrega,
      })
      toast({
        title: `Pedido #${pedido.numero} atualizado`,
        description:
          `Novo total: ${brl(Number(r.valor_total) || 0)}` +
          (r.parcelas_criadas ? ` · ${r.parcelas_criadas} parcela(s) refeitas` : ''),
      })
      onSalvo()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar o pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={pedido != null} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[1200px] max-h-[92vh] overflow-y-auto p-8"
        style={arrastar.estilo}
      >
        <DialogHeader {...arrastar.alca}>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4 text-amber-600" />
            Editar pedido #{pedido?.numero} — {pedido?.fornecedor_nome}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Ajuste o que o fornecedor respondeu antes de aprovar. Marque "Tirar" para retirar um item
            (a necessidade dele volta a aparecer). Arraste pelo título para ver a tela de trás.
          </p>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Quantidade</TableHead>
                    <TableHead className="text-xs w-[120px] text-right">Preço de custo (R$)</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">ST</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">IPI</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Outras despesas</TableHead>
                    <TableHead className="text-xs w-[110px] text-right">Total (R$/un.)</TableHead>
                    <TableHead className="text-xs w-[60px] text-center">Tirar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculadas.map((l) => (
                    <TableRow key={l.id} className={cn(l.remover && 'opacity-50 line-through')}>
                      <TableCell className="text-sm">
                        <p className="font-medium text-slate-800 line-clamp-1">{l.produto}</p>
                        {l.codigo && (
                          <span className="font-mono text-xs text-slate-400">{l.codigo}</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9 text-sm text-right"
                          value={l.quantidade}
                          disabled={l.remover}
                          onChange={(e) => mudar(l.id, 'quantidade', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9 text-sm text-right"
                          value={l.custoLiquido}
                          disabled={l.remover}
                          onChange={(e) => mudar(l.id, 'custoLiquido', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <CampoPercentual
                          value={l.stPerc}
                          valorReais={l.c.st}
                          onChange={(v) => mudar(l.id, 'stPerc', v)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <CampoPercentual
                          value={l.ipiPerc}
                          valorReais={l.c.ipi}
                          onChange={(v) => mudar(l.id, 'ipiPerc', v)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <CampoPercentual
                          value={l.outrasPerc}
                          valorReais={l.c.outras}
                          onChange={(v) => mudar(l.id, 'outrasPerc', v)}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-slate-700">
                        {l.c.total > 0 ? brl(l.c.total) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={l.remover}
                          onCheckedChange={(v) => mudar(l.id, 'remover', v === true)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <TotaisCompra
              totalProdutos={totalProdutos}
              totalComImpostos={totalComImpostos}
              descontoPedidoPerc={descontoNum}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Empresa que está comprando" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Desconto do pedido (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  className="h-10 text-sm"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Data prevista de entrega</Label>
                <Input
                  type="date"
                  className="h-10 text-sm"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Condições de pagamento</Label>
                <Input
                  placeholder="30/60/90 (dias) ou datas: 15/11, 15/12"
                  className="h-10 text-sm"
                  value={condicoes}
                  onChange={(e) => setCondicoes(e.target.value)}
                />
                <p className="text-[11px] text-slate-500">
                  As parcelas não pagas são refeitas em partes iguais ao salvar.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Local de entrega</Label>
                <Input
                  className="h-10 text-sm"
                  value={localEntrega}
                  onChange={(e) => setLocalEntrega(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Observação</Label>
                <Textarea
                  rows={2}
                  className="text-sm resize-none"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Voltar
          </Button>
          <Button
            onClick={salvar}
            disabled={!valido || salvando || carregando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]"
          >
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
