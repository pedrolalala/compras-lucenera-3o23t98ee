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
  type EditarPedidoItem,
  type PedidoCompraRow,
} from '@/services/pedido-compra'
import {
  CampoPercentual,
  TotaisCompra,
  brl,
  calcularCustoItem,
  lerNumero,
} from '@/components/compra/custo-compra'
import { CondicaoPagamentoCampo } from '@/components/compra/CondicaoPagamentoCampo'
import { useArrastavel } from '@/components/compra/use-arrastavel'

// SPEC-209 D3: o fornecedor respondeu (mudou quantidade, deu desconto, faltou item...) e a Débora
// ajusta o pedido antes de aprovar. Só vale para "Aguardando aprovar" (o banco também barra).

// SPEC-213: a mesma peça (vários L) aparece numa linha só, com a quantidade somada. Por baixo, cada
// L continua sendo um item do pedido (o vínculo com a venda é por item), então ao salvar a quantidade
// total é redistribuída: o que aumentar vai para a primeira linha; o que diminuir sai das últimas
// (linha que zera é tirada e a necessidade daquele L volta a aparecer).
interface ParteLinha {
  id: string
  quantidade: number
  ls: string[]
}

interface LinhaEdicao {
  id: string
  partes: ParteLinha[]
  produto: string
  codigo: string | null
  quantidade: string
  custoLiquido: string
  stPerc: string
  ipiPerc: string
  outrasPerc: string
  remover: boolean
}

function distribuir(partes: ParteLinha[], total: number): { id: string; quantidade: number }[] {
  const soma = partes.reduce((s, p) => s + p.quantidade, 0)
  const qtds = partes.map((p) => p.quantidade)
  if (total >= soma) {
    qtds[0] += total - soma
  } else {
    let falta = soma - total
    for (let i = qtds.length - 1; i >= 0 && falta > 0; i--) {
      const tira = Math.min(qtds[i], falta)
      qtds[i] -= tira
      falta -= tira
    }
  }
  return partes.map((p, i) => ({ id: p.id, quantidade: Math.round(qtds[i] * 1000) / 1000 }))
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
      .then((itens) => {
        // SPEC-213: agrupa por peça, na ordem em que aparece no pedido
        const grupos = new Map<string, typeof itens>()
        for (const i of itens) grupos.set(i.produto_id, [...(grupos.get(i.produto_id) ?? []), i])
        setLinhas(
          Array.from(grupos.values()).map((grupo) => {
            const i = grupo[0]
            const base = i.custo_liquido ?? i.custo_unitario
            return {
              id: i.produto_id,
              partes: grupo.map((g) => ({ id: g.id, quantidade: g.quantidade, ls: g.ls })),
              produto: i.produto_nome,
              codigo: i.produto_codigo,
              quantidade: String(grupo.reduce((s, g) => s + g.quantidade, 0)),
              custoLiquido: String(base),
              stPerc: percentualDoValor(i.valor_st, base),
              ipiPerc: percentualDoValor(i.valor_ipi, base),
              outrasPerc: percentualDoValor(i.valor_outras_despesas, base),
              remover: false,
            }
          }),
        )
      })
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
  // SPEC-222 F8: condição de pagamento obrigatória
  const valido =
    ativas.length > 0 && ativas.every((l) => l.qtd > 0 && l.c.total > 0) && !!condicoes.trim()

  async function salvar() {
    if (!pedido || !valido) return
    setSalvando(true)
    try {
      const r = await editarPedidoCompra({
        pedido_id: pedido.id,
        itens: calculadas.flatMap((l): EditarPedidoItem[] =>
          l.remover
            ? l.partes.map((p) => ({ pedido_item_id: p.id, remover: true }))
            : distribuir(l.partes, l.qtd).map((p) =>
                p.quantidade <= 0
                  ? { pedido_item_id: p.id, remover: true }
                  : {
                      pedido_item_id: p.id,
                      quantidade: p.quantidade,
                      custo_unitario: l.c.total,
                      custo_liquido: l.custo || null,
                      valor_ipi: l.c.ipi || null,
                      valor_st: l.c.st || null,
                      valor_outras_despesas: l.c.outras || null,
                    },
              ),
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
            Ajuste o que o fornecedor respondeu antes de aprovar. A mesma peça de vários L aparece numa
            linha só, com a quantidade somada: se diminuir, a diferença sai dos últimos L da lista (a
            necessidade deles volta a aparecer). Marque "Tirar" para retirar a peça. Arraste pelo título
            para ver a tela de trás.
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
                    <TableHead className="text-xs w-[120px] text-right">Total do item (R$)</TableHead>
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
                        {/* SPEC-213: de quais L vem a quantidade somada */}
                        {l.partes.some((p) => p.ls.length > 0) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {l.partes
                              .map((p) => `${p.ls.join('/') || 'sem L'}: ${p.quantidade.toLocaleString('pt-BR')}`)
                              .join(' · ')}
                          </p>
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
                      {/* quantidade × total por unidade (com impostos) */}
                      <TableCell className="text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                        {l.qtd > 0 && l.c.total > 0 ? brl(l.qtd * l.c.total) : '—'}
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
              impostos={{
                st: ativas.reduce((s, l) => s + l.qtd * l.c.st, 0),
                ipi: ativas.reduce((s, l) => s + l.qtd * l.c.ipi, 0),
                outras: ativas.reduce((s, l) => s + l.qtd * l.c.outras, 0),
              }}
              desconto={
                <>
                  <Label className="text-slate-600 font-normal">Desconto do pedido (%)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    className="h-8 w-24 text-right text-sm bg-white"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </>
              }
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
                <Label className="text-sm text-slate-600">Data prevista de entrega</Label>
                <Input
                  type="date"
                  className="h-10 text-sm"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                />
              </div>
              <CondicaoPagamentoCampo value={condicoes} onChange={setCondicoes} />
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
