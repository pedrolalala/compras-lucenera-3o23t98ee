import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, FileText, Loader2, Paperclip, ExternalLink, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  buscarPedidoPorNumero,
  criarNotaFiscalCompra,
  getNotasFiscaisCompra,
  type PedidoParaEntrada,
  type NotaFiscalCompraRow,
} from '@/services/notas-fiscais-compra'

function fmtBRL(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export default function EntradaNotaFiscal() {
  const { toast } = useToast()

  const [numeroPedido, setNumeroPedido] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [pedido, setPedido] = useState<PedidoParaEntrada | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)

  const [numeroNf, setNumeroNf] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [historico, setHistorico] = useState<NotaFiscalCompraRow[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(true)

  const carregarHistorico = useCallback(async () => {
    setLoadingHistorico(true)
    try {
      const data = await getNotasFiscaisCompra()
      setHistorico(data)
    } catch {
      // silencioso — histórico não é crítico pro fluxo principal
    } finally {
      setLoadingHistorico(false)
    }
  }, [])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  async function buscarPedido(e?: React.FormEvent) {
    e?.preventDefault()
    if (!numeroPedido.trim()) return
    setBuscando(true)
    setNaoEncontrado(false)
    setPedido(null)
    try {
      const result = await buscarPedidoPorNumero(numeroPedido.trim())
      if (result) {
        setPedido(result)
        setValor(result.valor_total != null ? String(result.valor_total) : '')
      } else {
        setNaoEncontrado(true)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao buscar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBuscando(false)
    }
  }

  function limparFormulario() {
    setPedido(null)
    setNumeroPedido('')
    setNumeroNf('')
    setDataEmissao('')
    setValor('')
    setObservacao('')
    setArquivo(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pedido || !numeroNf.trim()) return
    setSalvando(true)
    try {
      await criarNotaFiscalCompra({
        pedido_compra_id: pedido.id,
        numero_nf: numeroNf,
        data_emissao: dataEmissao || null,
        valor: valor ? parseFloat(valor) : null,
        observacao: observacao || null,
        arquivo,
      })
      toast({ title: 'Entrada de nota fiscal registrada' })
      limparFormulario()
      carregarHistorico()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar entrada',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Entrada de Nota Fiscal
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Busque o pedido de compra pelo número e registre a nota fiscal recebida do fornecedor —
          pode anexar o PDF ou uma foto da nota.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wide text-slate-600">
            1. Localizar pedido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={buscarPedido} className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Número do pedido..."
                className="pl-9"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={buscando || !numeroPedido.trim()}>
              {buscando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Buscar
            </Button>
          </form>

          {naoEncontrado && (
            <p className="text-sm text-red-600 mt-3">
              Nenhum pedido encontrado com esse número. Confira e tente novamente.
            </p>
          )}

          {pedido && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-slate-500">Pedido</p>
                <p className="font-semibold">{pedido.numero}</p>
              </div>
              <div>
                <p className="text-slate-500">Fornecedor</p>
                <p className="font-semibold">{pedido.fornecedor_nome}</p>
              </div>
              <div>
                <p className="text-slate-500">Empresa</p>
                <p className="font-semibold">{pedido.empresa_nome ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Valor do pedido</p>
                <p className="font-semibold">{fmtBRL(pedido.valor_total)}</p>
              </div>
              {pedido.itens.length > 0 && (
                <div className="sm:col-span-4">
                  <p className="text-slate-500 mb-1">Itens</p>
                  <ul className="text-xs text-slate-600 space-y-0.5">
                    {pedido.itens.map((it, idx) => (
                      <li key={idx}>
                        {it.quantidade}x {it.produto_nome}{' '}
                        {it.produto_codigo && (
                          <span className="font-mono text-slate-400">({it.produto_codigo})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {pedido && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wide text-slate-600 flex items-center gap-2">
              <FileText className="w-4 h-4" /> 2. Registrar nota fiscal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da NF *</Label>
                <Input
                  required
                  value={numeroNf}
                  onChange={(e) => setNumeroNf(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de emissão</Label>
                <Input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Anexo (PDF ou foto)
                </Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  rows={2}
                  className="resize-none"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={limparFormulario}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvando || !numeroNf.trim()}>
                  {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Registrar Entrada
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wide text-slate-600">
            Últimas entradas
          </CardTitle>
          <Button size="sm" variant="outline" onClick={carregarHistorico} disabled={loadingHistorico}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingHistorico ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs">Nº NF</TableHead>
                <TableHead className="text-xs">Pedido</TableHead>
                <TableHead className="text-xs">Fornecedor</TableHead>
                <TableHead className="text-xs">Empresa</TableHead>
                <TableHead className="text-xs">Emissão</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Anexo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistorico ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : historico.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">
                    Nenhuma entrada registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                historico.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="text-sm font-medium">{nf.numero_nf}</TableCell>
                    <TableCell className="text-sm font-mono text-xs">{nf.pedido_numero}</TableCell>
                    <TableCell className="text-sm">{nf.fornecedor_nome}</TableCell>
                    <TableCell className="text-sm">{nf.empresa_nome ?? '—'}</TableCell>
                    <TableCell className="text-sm">{fmtDate(nf.data_emissao)}</TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {fmtBRL(nf.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      {nf.arquivo_url ? (
                        <a
                          href={nf.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          <ExternalLink className="w-3 h-3" /> Ver
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
