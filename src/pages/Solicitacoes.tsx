import { useState, useEffect, useCallback } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RefreshCw, Check, X, ClipboardList, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getSolicitacoesCompra,
  atualizarSolicitacaoCompra,
  aprovarSolicitacaoCompra,
  rejeitarSolicitacaoCompra,
  getEmpresasSimples,
  type SolicitacaoCompraRow,
  type EmpresaSimples,
} from '@/services/solicitacoes-compra'

const ABAS = [
  { value: 'aguardando_aprovar', label: 'Aguardando aprovar' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
]

export default function Solicitacoes() {
  const { toast } = useToast()
  const [aba, setAba] = useState('aguardando_aprovar')
  const [rows, setRows] = useState<SolicitacaoCompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<EmpresaSimples[]>([])
  const [processandoId, setProcessandoId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSolicitacoesCompra(aba)
      setRows(data)
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar solicitações.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [aba, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    getEmpresasSimples()
      .then(setEmpresas)
      .catch(() => {})
  }, [])

  function atualizarCampoLocal(id: string, patch: Partial<SolicitacaoCompraRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function salvarCampo(id: string, patch: Record<string, any>) {
    try {
      await atualizarSolicitacaoCompra(id, patch)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar alteração',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
      loadData()
    }
  }

  async function aprovar(row: SolicitacaoCompraRow) {
    if (!row.fornecedor_id) {
      toast({
        title: 'Sem fornecedor definido',
        description:
          'Esta marca ainda não tem fornecedor vinculado — resolva em Marcas antes de aprovar.',
        variant: 'destructive',
      })
      return
    }
    if (!row.custo_unitario || row.custo_unitario <= 0) {
      toast({
        title: 'Informe o custo unitário',
        description: 'Preencha o custo unitário antes de aprovar (necessário para gerar o pedido).',
        variant: 'destructive',
      })
      return
    }
    setProcessandoId(row.id)
    try {
      const result = await aprovarSolicitacaoCompra(row.id, row.custo_unitario)
      toast({ title: 'Solicitação aprovada', description: `Pedido gerado (${result.pedido_compra_id.slice(0, 8)}...)` })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoId(null)
    }
  }

  async function rejeitar(row: SolicitacaoCompraRow) {
    setProcessandoId(row.id)
    try {
      await rejeitarSolicitacaoCompra(row.id)
      toast({ title: 'Solicitação rejeitada', description: 'O item volta para a Necessidade de Compra.' })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao rejeitar',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoId(null)
    }
  }

  const editavel = aba === 'aguardando_aprovar'

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Solicitações
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Aprovar Necessidade de Compra — escolha empresa/fornecedor antes de efetivar o pedido.
            Passo opcional: você também pode fechar pedidos direto pela Necessidade de Compra.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading} className="shadow-sm">
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          {ABAS.map((a) => (
            <TabsTrigger key={a.value} value={a.value}>
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={aba} className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px] w-full">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs">Marca / Fornecedor</TableHead>
                    <TableHead className="text-xs w-[160px]">Empresa</TableHead>
                    <TableHead className="text-xs w-[130px]">Perfil</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Quantidade</TableHead>
                    <TableHead className="text-xs w-[110px] text-right">Custo unit.</TableHead>
                    <TableHead className="text-xs w-[140px]">Cond. pagamento</TableHead>
                    {aba === 'aguardando_aprovar' && (
                      <TableHead className="text-xs w-[140px] text-right">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-sm text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-sm text-slate-400">
                        Nenhuma solicitação {ABAS.find((a) => a.value === aba)?.label.toLowerCase()}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id} className="h-16">
                        <TableCell className="text-sm">
                          <p className="font-medium text-slate-800 line-clamp-1">{r.produto_nome}</p>
                          {r.produto_codigo && (
                            <span className="font-mono text-xs text-slate-400">
                              {r.produto_codigo}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <p className="text-slate-700">{r.marca_nome ?? '—'}</p>
                          <p
                            className={cn(
                              'text-xs',
                              r.fornecedor_nome ? 'text-slate-500' : 'text-red-500 font-medium',
                            )}
                          >
                            {r.fornecedor_nome ?? 'Sem fornecedor'}
                          </p>
                        </TableCell>
                        <TableCell>
                          {editavel ? (
                            <Select
                              value={r.empresa_id ?? undefined}
                              onValueChange={(v) => {
                                atualizarCampoLocal(r.id, { empresa_id: v })
                                salvarCampo(r.id, { empresa_id: v })
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Empresa" />
                              </SelectTrigger>
                              <SelectContent>
                                {empresas.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-slate-600">{r.empresa_nome ?? '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editavel ? (
                            <Select
                              value={r.perfil ?? 'nenhum'}
                              onValueChange={(v) => {
                                const val = v === 'nenhum' ? null : v
                                atualizarCampoLocal(r.id, { perfil: val })
                                salvarCampo(r.id, { perfil: val })
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Perfil" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nenhum">—</SelectItem>
                                <SelectItem value="ribeirao">Ribeirão</SelectItem>
                                <SelectItem value="sao_paulo">São Paulo</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-slate-600">
                              {r.perfil === 'ribeirao'
                                ? 'Ribeirão'
                                : r.perfil === 'sao_paulo'
                                  ? 'São Paulo'
                                  : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editavel ? (
                            <Input
                              type="number"
                              step="0.001"
                              className="h-8 text-xs text-right"
                              value={r.quantidade}
                              onChange={(e) =>
                                atualizarCampoLocal(r.id, { quantidade: Number(e.target.value) })
                              }
                              onBlur={(e) =>
                                salvarCampo(r.id, { quantidade: Number(e.target.value) })
                              }
                            />
                          ) : (
                            <span className="text-sm">{r.quantidade}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editavel ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs text-right"
                              value={r.custo_unitario ?? ''}
                              placeholder="obrigatório p/ aprovar"
                              onChange={(e) =>
                                atualizarCampoLocal(r.id, {
                                  custo_unitario: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              onBlur={(e) =>
                                salvarCampo(r.id, {
                                  custo_unitario: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            />
                          ) : (
                            <span className="text-sm">
                              {r.custo_unitario != null
                                ? r.custo_unitario.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })
                                : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editavel ? (
                            <Input
                              className="h-8 text-xs"
                              value={r.condicao_pagamento ?? ''}
                              placeholder="ex: 30/60/90"
                              onChange={(e) =>
                                atualizarCampoLocal(r.id, { condicao_pagamento: e.target.value })
                              }
                              onBlur={(e) =>
                                salvarCampo(r.id, { condicao_pagamento: e.target.value || null })
                              }
                            />
                          ) : (
                            <span className="text-sm text-slate-600">
                              {r.condicao_pagamento ?? '—'}
                            </span>
                          )}
                        </TableCell>
                        {aba === 'aguardando_aprovar' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                disabled={processandoId === r.id}
                                onClick={() => aprovar(r)}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                disabled={processandoId === r.id}
                                onClick={() => rejeitar(r)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
