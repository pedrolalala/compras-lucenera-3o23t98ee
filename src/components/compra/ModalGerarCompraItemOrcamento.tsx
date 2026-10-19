import { useState, useEffect } from 'react'
import { semPrefixo } from '@/lib/numeros'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, PackageCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  criarPedidoCompraLote,
  getEmpresas,
  getProdutoImpostosBulk,
  vincularOrigemPedidoItem,
  type Empresa,
} from '@/services/pedido-compra'
import type { NecessidadeCompraItemRow } from '@/services/necessidade-compra-item'
import {
  CampoPercentual,
  TotaisCompra,
  brl,
  calcularCustoItem,
  percentualParaCampo,
} from '@/components/compra/custo-compra'

// SPEC-155 (P3): remove as setinhas de incremento nativas dos campos
// numéricos deste modal -- pedido explícito do relatório (atrapalhavam
// digitação de valor com várias casas decimais). Tailwind não tem
// utilitário pronto pra isso; arbitrary variants cobrem WebKit e Firefox.
const NO_SPINNER =
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

// SPEC-040 — Fluxo B ("Por Item de Orçamento"). Modelado sobre
// ModalPedidoLote.tsx (Fluxo A, não alterado), mas com duas diferenças
// centrais exigidas pela SPEC:
//   - a chave de cada linha é projeto_item_id (não produto_id) — o mesmo
//     produto_id pode aparecer 2+ vezes no lote (mesmo produto em L Fixos
//     diferentes, do mesmo orçamento ou de orçamentos distintos), então o
//     mapeamento de resultado -> vínculo de origem é feito por ÍNDICE do
//     array (criar_pedido_compra_lote preserva a ordem de p_itens), nunca
//     por produto_id;
//   - o vínculo de origem (vincular_origem_pedido_compra_item) é chamado
//     SEMPRE, para cada linha, e uma falha aparece como toast de erro claro
//     (P-03) — não é engolido silenciosamente como em ModalPedidoLote.tsx.

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  itens: NecessidadeCompraItemRow[]
  fornecedorId: string
  fornecedorNome: string
  onSuccess: () => void
}

interface LinhaItem {
  projeto_item_id: string
  produto_id: string
  produto: string
  produto_codigo: string | null
  orcamento_numero: string | null
  l_fixo: string | null
  quantidade: string
  // SPEC-209 B: preço de custo (já com desconto) + ST/IPI/outras despesas em % (sem ICMS)
  custoLiquido: string
  stPerc: string
  ipiPerc: string
  outrasPerc: string
}

export function ModalGerarCompraItemOrcamento({
  open,
  onOpenChange,
  itens,
  fornecedorId,
  fornecedorNome,
  onSuccess,
}: Props) {
  const { toast } = useToast()

  const [linhas, setLinhas] = useState<LinhaItem[]>([])
  const [numero, setNumero] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [condicoesPagamento, setCondicoesPagamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  // SPEC-155 (P3): empresa emitente (mesmo padrão já obrigatório em
  // ModalPedidoLote.tsx, Fluxo A -- este modal, Fluxo B, nunca coletava isso,
  // então todo pedido gerado por aqui ficava com empresa_id nulo).
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  // SPEC-155 (P3): desconto negociado (%) e local de entrega -- novos campos
  // pedidos no relatório, ambos opcionais.
  const [descontoPercentual, setDescontoPercentual] = useState('')
  const [localEntrega, setLocalEntrega] = useState('')

  useEffect(() => {
    if (!open) return
    setLinhas(
      itens.map((it) => ({
        projeto_item_id: it.projeto_item_id,
        produto_id: it.produto_id,
        produto: it.produto,
        produto_codigo: it.produto_codigo,
        orcamento_numero: it.orcamento_numero,
        l_fixo: it.l_fixo,
        quantidade: String(it.pendente_item),
        custoLiquido: it.preco_custo != null ? String(it.preco_custo) : '',
        stPerc: '',
        ipiPerc: '',
        outrasPerc: '',
      })),
    )
    setNumero('')
    setDataPrevista('')
    setCondicoesPagamento('')
    setObservacao('')
    setEmpresaId('')
    setDescontoPercentual('')
    setLocalEntrega('')
    getEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))

    getProdutoImpostosBulk(
      itens.map((it) => it.produto_id),
      fornecedorId || null,
    )
      .then((impostos) => {
        setLinhas((prev) =>
          prev.map((l) => {
            const dados = impostos.get(l.produto_id)
            if (!dados) return l
            const custoLiquido = dados.custoUnitario ?? (parseFloat(l.custoLiquido) || 0)
            return {
              ...l,
              custoLiquido: custoLiquido > 0 ? String(custoLiquido) : l.custoLiquido,
              stPerc: percentualParaCampo(dados.porcStPerc),
              ipiPerc: percentualParaCampo(dados.ipiEntradaPerc),
              outrasPerc: percentualParaCampo(dados.despesasPerc),
            }
          }),
        )
      })
      .catch(() => {
        // silencioso — pré-preenchimento de custo é conveniência, não obrigatório.
        // Não confundir com o vínculo de origem (P-03), que É obrigatório e
        // nunca falha silenciosamente — ver handleSubmit.
      })
  }, [open, itens, fornecedorId])

  function atualizarLinha(
    projetoItemId: string,
    campo: 'quantidade' | 'custoLiquido' | 'stPerc' | 'ipiPerc' | 'outrasPerc',
    valor: string,
  ) {
    setLinhas((prev) =>
      prev.map((l) => (l.projeto_item_id === projetoItemId ? { ...l, [campo]: valor } : l)),
    )
  }

  const linhasValidas = linhas.map((l) => {
    const custoLiquido = parseFloat(l.custoLiquido) || 0
    const c = calcularCustoItem(custoLiquido, l)
    return {
      ...l,
      qtd: parseFloat(l.quantidade),
      custoLiquidoNum: custoLiquido,
      valorIpiNum: c.ipi,
      valorStNum: c.st,
      valorOutrasNum: c.outras,
      custo: c.total,
    }
  })

  const todasLinhasValidas =
    linhasValidas.length > 0 && linhasValidas.every((l) => l.qtd > 0 && l.custo > 0)

  // SPEC-155 (P3): Empresa emitente passa a ser obrigatória, mesmo padrão
  // já usado no Fluxo A (ModalPedidoLote.tsx).
  const canSubmit = todasLinhasValidas && !!empresaId && !loading

  // SPEC-209 B5: total dos produtos (preço de custo × qtd) e total com impostos.
  const totalProdutos = linhasValidas.reduce(
    (s, l) => (l.qtd > 0 ? s + l.qtd * l.custoLiquidoNum : s),
    0,
  )
  const totalComImpostos = linhasValidas.reduce(
    (s, l) => (l.qtd > 0 && l.custo > 0 ? s + l.qtd * l.custo : s),
    0,
  )

  // SPEC-155 (P3, achado do revisor): clampa em [0, 100] tanto pra prévia
  // quanto pro valor enviado -- sem isso, digitar negativo fazia a prévia
  // mostrar um total "com desconto" maior que o real (submit descartava o
  // valor silenciosamente), e digitar >100 fazia a prévia mostrar total
  // negativo antes da RPC rejeitar.
  const descontoNum = Math.min(100, Math.max(0, parseFloat(descontoPercentual) || 0))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      const result = await criarPedidoCompraLote({
        fornecedor_id: fornecedorId,
        itens: linhasValidas.map((l) => ({
          produto_id: l.produto_id,
          quantidade: l.qtd,
          custo_unitario: l.custo,
          custo_liquido: l.custoLiquidoNum || undefined,
          valor_ipi: l.valorIpiNum || undefined,
          valor_st: l.valorStNum || undefined,
          valor_outras_despesas: l.valorOutrasNum || undefined,
        })),
        numero: numero.trim() || undefined,
        data_prevista_entrega: dataPrevista || undefined,
        condicoes_pagamento: condicoesPagamento.trim() || undefined,
        observacao: observacao.trim() || undefined,
        empresa_id: empresaId,
        desconto_percentual: descontoNum > 0 ? descontoNum : undefined,
        local_entrega: localEntrega.trim() || undefined,
      })

      // Vínculo de origem OBRIGATÓRIO (P-03) — mapeado por índice, porque
      // criar_pedido_compra_lote preserva a ordem de p_itens e o mesmo
      // produto_id pode se repetir entre linhas (L Fixos diferentes).
      const falhas: string[] = []
      for (let i = 0; i < linhasValidas.length; i++) {
        const linha = linhasValidas[i]
        const itemCriado = result.itens[i]
        if (!itemCriado) {
          falhas.push(
            `${linha.orcamento_numero ?? '—'} / ${linha.l_fixo ?? '—'} (${linha.produto}): item do pedido não retornado pela API.`,
          )
          continue
        }
        try {
          await vincularOrigemPedidoItem([
            {
              pedido_compra_item_id: itemCriado.pedido_item_id,
              projeto_item_id: linha.projeto_item_id,
              quantidade_atendida: linha.qtd,
            },
          ])
        } catch (err: any) {
          falhas.push(
            `${linha.orcamento_numero ?? '—'} / ${linha.l_fixo ?? '—'} (${linha.produto}): ${err?.message ?? 'erro desconhecido'}`,
          )
        }
      }

      if (falhas.length > 0) {
        toast({
          title: `Pedido #${result.numero} criado, mas ${falhas.length} vínculo(s) de origem falharam`,
          description: falhas.join(' | '),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Compra gerada',
          description: `Pedido #${result.numero} criado com ${result.qtd_itens} item(ns), todos vinculados à origem.`,
        })
      }
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar compra',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* SPEC-155 (P3, item 1): modal aumentada (1040px -> 1440px) -- campos
          e tabela ficavam apertados/pouco legíveis. */}
      <DialogContent className="sm:max-w-[1440px] max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            Gerar Compra por Item de Orçamento
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* SPEC-155 (P3, item 5): fornecedor como campo visível no corpo do
              pedido, não só no título da modal. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Fornecedor</Label>
            <p className="text-sm font-semibold text-slate-800">{fornecedorNome}</p>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Orçamento</TableHead>
                  <TableHead className="text-xs">L Fixo</TableHead>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs w-[110px] text-right">Quantidade</TableHead>
                  {/* SPEC-209 B1/B2: sem ICMS; ordem Preço de custo · ST · IPI · Outras
                      despesas. % vem do cadastro e pode ser ajustado; o R$ aparece embaixo. */}
                  <TableHead className="text-xs w-[130px] text-right">Preço de custo (R$)</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">ST</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">IPI</TableHead>
                  <TableHead className="text-xs w-[110px] text-right">Outras despesas</TableHead>
                  <TableHead className="text-xs w-[120px] text-right">Total (R$/un.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasValidas.map((l) => (
                  <TableRow key={l.projeto_item_id}>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {semPrefixo(l.orcamento_numero) || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {l.l_fixo ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium text-slate-800 line-clamp-1">{l.produto}</p>
                      {l.produto_codigo && (
                        <span className="font-mono text-xs text-slate-400">{l.produto_codigo}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className={cn('h-9 text-sm text-right', NO_SPINNER)}
                        value={l.quantidade}
                        onChange={(e) =>
                          atualizarLinha(l.projeto_item_id, 'quantidade', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn('h-9 text-sm text-right', NO_SPINNER)}
                        value={l.custoLiquido}
                        onChange={(e) =>
                          atualizarLinha(l.projeto_item_id, 'custoLiquido', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <CampoPercentual
                        value={l.stPerc}
                        valorReais={l.valorStNum}
                        onChange={(v) => atualizarLinha(l.projeto_item_id, 'stPerc', v)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <CampoPercentual
                        value={l.ipiPerc}
                        valorReais={l.valorIpiNum}
                        onChange={(v) => atualizarLinha(l.projeto_item_id, 'ipiPerc', v)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <CampoPercentual
                        value={l.outrasPerc}
                        valorReais={l.valorOutrasNum}
                        onChange={(v) => atualizarLinha(l.projeto_item_id, 'outrasPerc', v)}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-700">
                      {l.custo > 0 ? brl(l.custo) : '—'}
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

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">
              Empresa <span className="text-red-500">*</span>
            </Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-11 text-sm">
                <SelectValue placeholder="Selecione a empresa que está comprando..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Desconto negociado (%, opcional)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                className={cn('h-11 text-sm', NO_SPINNER)}
                value={descontoPercentual}
                onChange={(e) => setDescontoPercentual(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Local de entrega (opcional)</Label>
              <Input
                placeholder="ex: Depósito Ribeirão Preto"
                className="h-11 text-sm"
                value={localEntrega}
                onChange={(e) => setLocalEntrega(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Nº do pedido / referência (opcional)</Label>
            <Input
              placeholder="Gerado automaticamente se deixado em branco (ex: PC-2026-0001)"
              className="h-11 text-sm"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Data prevista de entrega (opcional)</Label>
            <Input
              type="date"
              className="h-11 text-sm"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Condições de pagamento (opcional)</Label>
            <Input
              placeholder="ex: 30/60/90 dias"
              className="h-11 text-sm"
              value={condicoesPagamento}
              onChange={(e) => setCondicoesPagamento(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Observação (opcional)</Label>
            <Textarea
              placeholder="Observações adicionais..."
              className="text-sm resize-none"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <p className="text-xs text-slate-500">
            O vínculo de origem com cada item de orçamento é obrigatório e é feito automaticamente
            ao confirmar — se algum vínculo falhar, você verá um aviso específico por linha, mesmo
            com o pedido já criado.
          </p>

          <DialogFooter className="pt-4 gap-3">
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
              type="submit"
              disabled={!canSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px] h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Confirmar e Gerar Compra
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
