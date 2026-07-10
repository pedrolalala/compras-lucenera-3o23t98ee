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
import { Loader2, ShoppingCart, Search, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { criarPedidoCompra, getFornecedores, type Fornecedor } from '@/services/pedido-compra'
import type { NecessidadeCompraRow } from '@/services/necessidade-compra'

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
  custoUnitario: '',
  numero: '',
  dataPrevista: '',
  condicoesPagamento: '',
  observacao: '',
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

  useEffect(() => {
    if (!open || !produto) return
    setForm({ ...EMPTY, quantidade: String(produto.necessidade_compra) })
    setFornecedores([])
    setShowList(false)
    carregarFornecedores('')
  }, [open, produto])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!open) return
    debounceRef.current = setTimeout(() => {
      carregarFornecedores(form.fornecedorSearch)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
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

  function selecionarFornecedor(f: Fornecedor) {
    setForm((prev) => ({ ...prev, fornecedorId: f.id, fornecedorNome: f.nome, fornecedorSearch: '' }))
    setShowList(false)
  }

  function limparFornecedor() {
    setForm((prev) => ({ ...prev, fornecedorId: '', fornecedorNome: '', fornecedorSearch: '' }))
    setShowList(false)
  }

  const qtd = parseFloat(form.quantidade)
  const custo = parseFloat(form.custoUnitario)
  const canSubmit =
    !!form.fornecedorId &&
    qtd > 0 &&
    custo > 0 &&
    form.numero.trim().length > 0 &&
    !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!produto || !canSubmit) return
    setLoading(true)
    try {
      const result = await criarPedidoCompra({
        produto_id:            produto.produto_id,
        fornecedor_id:         form.fornecedorId,
        quantidade:            qtd,
        custo_unitario:        custo,
        numero:                form.numero.trim(),
        data_prevista_entrega: form.dataPrevista || undefined,
        condicoes_pagamento:   form.condicoesPagamento.trim() || undefined,
        observacao:            form.observacao.trim() || undefined,
      })
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

  const totalEstimado = qtd > 0 && custo > 0 ? (qtd * custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            Registrar Pedido de Compra
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Produto */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Produto</Label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm font-medium text-slate-800 truncate">{produto.produto}</span>
              {produto.produto_codigo && (
                <span className="shrink-0 font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {produto.produto_codigo}
                </span>
              )}
            </div>
          </div>

          {/* Fornecedor */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">
              Fornecedor <span className="text-red-500">*</span>
            </Label>
            {form.fornecedorId ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200">
                <span className="flex-1 text-sm font-medium text-emerald-800">{form.fornecedorNome}</span>
                <button type="button" onClick={limparFornecedor} className="text-emerald-400 hover:text-emerald-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={listRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Buscar fornecedor..."
                  className="pl-8 h-9 text-sm"
                  value={form.fornecedorSearch}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, fornecedorSearch: e.target.value }))
                    setShowList(true)
                  }}
                  onFocus={() => setShowList(true)}
                  autoComplete="off"
                />
                {showList && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-44">
                    {loadingFornecedores ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : fornecedores.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Nenhum fornecedor encontrado.</p>
                    ) : (
                      fornecedores.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800 border-b border-slate-100 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); selecionarFornecedor(f) }}
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

          {/* Quantidade e Custo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">
                Quantidade <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                placeholder="0"
                className="h-9 text-sm"
                value={form.quantidade}
                onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">
                Custo unitário (R$) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                className="h-9 text-sm"
                value={form.custoUnitario}
                onChange={(e) => setForm((prev) => ({ ...prev, custoUnitario: e.target.value }))}
              />
            </div>
          </div>

          {totalEstimado && (
            <p className="text-xs text-slate-500 text-right -mt-2">
              Total estimado: <span className="font-semibold text-slate-700">{totalEstimado}</span>
            </p>
          )}

          {/* Número do pedido */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">
              Nº do pedido / referência <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="ex: PC-2026-001"
              className="h-9 text-sm"
              value={form.numero}
              onChange={(e) => setForm((prev) => ({ ...prev, numero: e.target.value }))}
            />
          </div>

          {/* Data prevista */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Data prevista de entrega (opcional)</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={form.dataPrevista}
              onChange={(e) => setForm((prev) => ({ ...prev, dataPrevista: e.target.value }))}
            />
          </div>

          {/* Condições de pagamento */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Condições de pagamento (opcional)</Label>
            <Input
              placeholder="ex: 30/60/90 dias"
              className="h-9 text-sm"
              value={form.condicoesPagamento}
              onChange={(e) => setForm((prev) => ({ ...prev, condicoesPagamento: e.target.value }))}
            />
          </div>

          {/* Observação */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Observação (opcional)</Label>
            <Textarea
              placeholder="Observações adicionais..."
              className="text-sm resize-none"
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
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
