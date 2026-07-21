import { useState, useEffect, useRef } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, ShoppingCart, Search, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  criarPedidoCompra,
  getFornecedores,
  getProdutoImpostos,
  vincularOrigemPedidoItem,
  gerarParcelasPedidoCompra,
  type Fornecedor,
} from '@/services/pedido-compra'
import type { NecessidadeCompraRow } from '@/services/necessidade-compra'
import {
  getNecessidadeCompraDetalhe,
  type NecessidadeCompraDetalheRow,
} from '@/services/necessidade-compra-detalhe'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: NecessidadeCompraRow | null
  onSuccess: () => void
}

const EMPTY = {
  fornecedorId: '',
  fornecedorNome: '',
  fornecedorSearch: '',
  quantidade: '',
  custoLiquido: '',
  valorIcms: '',
  valorIpi: '',
  valorSt: '',
  numero: '',
  dataPrevista: '',
  condicoesPagamento: '',
  observacao: '',
  gerarParcelas: false,
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

export function ModalRegistrarCompra({ open, onOpenChange, produto, onSuccess }: Props) {
  const { toast } = useToast()

  const [form, setForm] = useState(EMPTY)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingFornecedores, setLoadingFornecedores] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // SPEC-038 Item 3: candidatos de origem (projeto_item_id) motivando a
  // necessidade deste produto — vínculo opcional, informativo.
  const [origens, setOrigens] = useState<NecessidadeCompraDetalheRow[]>([])
  const [loadingOrigens, setLoadingOrigens] = useState(false)
  const [origensSelecionadas, setOrigensSelecionadas] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !produto) return
    setForm({ ...EMPTY, quantidade: String(produto.necessidade_compra) })
    setFornecedores([])
    setShowList(false)
    setOrigensSelecionadas(new Set())
    carregarFornecedores('')
    carregarOrigens(produto.produto_id)
  }, [open, produto])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!open) return
    debounceRef.current = setTimeout(() => {
      carregarFornecedores(form.fornecedorSearch)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [form.fornecedorSearch, open])

  async function carregarFornecedores(search: string) {
    setLoadingFornecedores(true)
    try {
      const data = await getFornecedores(search || undefined)
      setFornecedores(data)
    } catch {
      // silencioso — não bloqueia o modal
    } finally {
      setLoadingFornecedores(false)
    }
  }

  async function carregarOrigens(produtoId: string) {
    setLoadingOrigens(true)
    try {
      const data = await getNecessidadeCompraDetalhe(produtoId)
      setOrigens(data)
    } catch {
      setOrigens([])
    } finally {
      setLoadingOrigens(false)
    }
  }

  // SPEC-038 Item 1 (P-02): pré-preenche custo líquido + ICMS/IPI/ST a
  // partir de produtos (e produto_fornecedores, se houver override para o
  // fornecedor selecionado) — sempre editável depois.
  async function preencherImpostos(produtoId: string, fornecedorId: string | null) {
    try {
      const dados = await getProdutoImpostos(produtoId, fornecedorId)
      const custoLiquido = dados.custoUnitario ?? 0
      const icms =
        custoLiquido > 0 ? round4((custoLiquido * (dados.icmsEntradaPerc ?? 0)) / 100) : 0
      const ipi = custoLiquido > 0 ? round4((custoLiquido * (dados.ipiEntradaPerc ?? 0)) / 100) : 0
      const st = custoLiquido > 0 ? round4((custoLiquido * (dados.porcStPerc ?? 0)) / 100) : 0
      setForm((prev) => ({
        ...prev,
        custoLiquido: custoLiquido > 0 ? String(custoLiquido) : prev.custoLiquido,
        valorIcms: String(icms),
        valorIpi: String(ipi),
        valorSt: String(st),
      }))
    } catch {
      // silencioso — campos continuam editáveis manualmente mesmo sem pré-preenchimento
    }
  }

  function selecionarFornecedor(f: Fornecedor) {
    setForm((prev) => ({
      ...prev,
      fornecedorId: f.id,
      fornecedorNome: f.nome,
      fornecedorSearch: '',
    }))
    setShowList(false)
    if (produto) preencherImpostos(produto.produto_id, f.id)
  }

  function limparFornecedor() {
    setForm((prev) => ({ ...prev, fornecedorId: '', fornecedorNome: '', fornecedorSearch: '' }))
    setShowList(false)
  }

  function toggleOrigem(projetoItemId: string) {
    setOrigensSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(projetoItemId)) next.delete(projetoItemId)
      else next.add(projetoItemId)
      return next
    })
  }

  const qtd = parseFloat(form.quantidade)
  const custoLiquido = parseFloat(form.custoLiquido) || 0
  const valorIcms = parseFloat(form.valorIcms) || 0
  const valorIpi = parseFloat(form.valorIpi) || 0
  const valorSt = parseFloat(form.valorSt) || 0
  const custoUnitarioTotal = custoLiquido + valorIcms + valorIpi + valorSt

  const canSubmit = !!form.fornecedorId && qtd > 0 && custoUnitarioTotal > 0 && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!produto || !canSubmit) return
    setLoading(true)
    try {
      const result = await criarPedidoCompra({
        produto_id: produto.produto_id,
        fornecedor_id: form.fornecedorId,
        quantidade: qtd,
        custo_unitario: custoUnitarioTotal,
        numero: form.numero.trim() || undefined,
        data_prevista_entrega: form.dataPrevista || undefined,
        condicoes_pagamento: form.condicoesPagamento.trim() || undefined,
        observacao: form.observacao.trim() || undefined,
        custo_liquido: custoLiquido || undefined,
        valor_icms: valorIcms || undefined,
        valor_ipi: valorIpi || undefined,
        valor_st: valorSt || undefined,
      })

      if (origensSelecionadas.size > 0) {
        try {
          await vincularOrigemPedidoItem(
            Array.from(origensSelecionadas).map((projetoItemId) => ({
              pedido_compra_item_id: result.pedido_item_id,
              projeto_item_id: projetoItemId,
            })),
          )
        } catch (err: any) {
          toast({
            title: 'Pedido criado, mas vínculo de origem falhou',
            description: err?.message ?? 'Tente vincular manualmente depois.',
            variant: 'destructive',
          })
        }
      }

      if (form.gerarParcelas && form.condicoesPagamento.trim()) {
        try {
          await gerarParcelasPedidoCompra(result.pedido_id)
        } catch (err: any) {
          toast({
            title: 'Pedido criado, mas parcelas não foram geradas',
            description:
              err?.message ??
              'Condições de pagamento não puderam ser interpretadas. Gere as parcelas manualmente.',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: 'Pedido registrado',
        description: `Pedido #${result.numero} registrado com sucesso.`,
      })
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!produto) return null

  const totalEstimado =
    qtd > 0 && custoUnitarioTotal > 0
      ? (qtd * custoUnitarioTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto p-8">
        {' '}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            Registrar Pedido de Compra
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Produto */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Produto</Label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-sm font-medium text-slate-800 truncate">{produto.produto}</span>
              {produto.produto_codigo && (
                <span className="shrink-0 font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  {produto.produto_codigo}
                </span>
              )}
            </div>
          </div>

          {/* Fornecedor (Marca) */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">
              Marca / Fornecedor <span className="text-red-500">*</span>
            </Label>
            {form.fornecedorId ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="flex-1 text-sm font-medium text-emerald-800">
                  {form.fornecedorNome}
                </span>
                <button
                  type="button"
                  onClick={limparFornecedor}
                  className="text-emerald-400 hover:text-emerald-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={listRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Buscar marca ou fornecedor..."
                  className="pl-10 h-11 text-sm"
                  value={form.fornecedorSearch}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, fornecedorSearch: e.target.value }))
                    setShowList(true)
                  }}
                  onFocus={() => setShowList(true)}
                  autoComplete="off"
                />
                {showList && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-52">
                    {loadingFornecedores ? (
                      <div className="flex items-center justify-center py-5">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : fornecedores.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-5">
                        Nenhuma marca encontrada.
                      </p>
                    ) : (
                      fornecedores.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-800 border-b border-slate-100 last:border-0"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selecionarFornecedor(f)
                          }}
                        >
                          {f.nome}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantidade */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">
              Quantidade <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="0"
              className="h-11 text-sm"
              value={form.quantidade}
              onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))}
            />
          </div>

          {/* Custo líquido + impostos (SPEC-038 Item 1) */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">
              Custo e impostos (R$/un.) <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-[11px] text-slate-500 font-normal">Custo líquido</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="h-10 text-sm"
                  value={form.custoLiquido}
                  onChange={(e) => setForm((prev) => ({ ...prev, custoLiquido: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 font-normal">ICMS</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="h-10 text-sm"
                  value={form.valorIcms}
                  onChange={(e) => setForm((prev) => ({ ...prev, valorIcms: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 font-normal">IPI</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="h-10 text-sm"
                  value={form.valorIpi}
                  onChange={(e) => setForm((prev) => ({ ...prev, valorIpi: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-500 font-normal">ST</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="h-10 text-sm"
                  value={form.valorSt}
                  onChange={(e) => setForm((prev) => ({ ...prev, valorSt: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 text-right">
              Custo unitário total:{' '}
              <span className="font-semibold text-slate-700">
                {custoUnitarioTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </p>
          </div>

          {totalEstimado && (
            <p className="text-sm text-slate-500 text-right -mt-2">
              Total estimado: <span className="font-semibold text-slate-700">{totalEstimado}</span>
            </p>
          )}

          {/* Número do pedido — SPEC-038 Item 2: opcional, gerado automaticamente */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Nº do pedido / referência (opcional)</Label>
            <Input
              placeholder="Gerado automaticamente se deixado em branco (ex: PC-2026-0001)"
              className="h-11 text-sm"
              value={form.numero}
              onChange={(e) => setForm((prev) => ({ ...prev, numero: e.target.value }))}
            />
          </div>

          {/* Data prevista */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Data prevista de entrega (opcional)</Label>
            <Input
              type="date"
              className="h-11 text-sm"
              value={form.dataPrevista}
              onChange={(e) => setForm((prev) => ({ ...prev, dataPrevista: e.target.value }))}
            />
          </div>

          {/* Condições de pagamento — SPEC-038 Item 4: opção de gerar parcelas */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Condições de pagamento (opcional)</Label>
            <Input
              placeholder="ex: 30/60/90 dias"
              className="h-11 text-sm"
              value={form.condicoesPagamento}
              onChange={(e) => setForm((prev) => ({ ...prev, condicoesPagamento: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 pt-1">
              <Checkbox
                checked={form.gerarParcelas}
                disabled={!form.condicoesPagamento.trim()}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, gerarParcelas: checked === true }))
                }
              />
              Gerar parcelas automaticamente ao registrar o pedido (editáveis depois)
            </label>
          </div>

          {/* Origem — SPEC-038 Item 3: vínculo informativo, opcional */}
          {(loadingOrigens || origens.length > 0) && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">
                Itens de projeto que motivaram esta compra (opcional)
              </Label>
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                {loadingOrigens ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                ) : (
                  origens.map((o) => (
                    <label
                      key={o.projeto_item_id}
                      className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={origensSelecionadas.has(o.projeto_item_id)}
                        onCheckedChange={() => toggleOrigem(o.projeto_item_id)}
                      />
                      <span className="font-mono text-slate-500">{o.projeto_codigo ?? '—'}</span>
                      <span className="text-slate-700 truncate flex-1">
                        {o.projeto_nome ?? '—'}{' '}
                        {o.orcamento_numero ? `· ${o.orcamento_numero}` : ''}
                      </span>
                      <span className="text-slate-400">{o.cliente ?? ''}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Observação (opcional)</Label>
            <Textarea
              placeholder="Observações adicionais..."
              className="text-sm resize-none"
              rows={3}
              value={form.observacao}
              onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
            />
          </div>

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
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px] h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Confirmar Pedido
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
