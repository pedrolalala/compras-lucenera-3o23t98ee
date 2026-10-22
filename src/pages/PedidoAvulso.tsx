import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, PackageCheck, Plus, Search, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { buscarProdutosParaPedido, type EstoqueProdutoRow } from '@/services/estoque-produtos'
import { getFornecedores, type Fornecedor } from '@/services/pedido-compra'
import type { LinhaCarrinho } from '@/services/necessidade-compra-item'
import { ModalGerarCompraItemOrcamento } from '@/components/compra/ModalGerarCompraItemOrcamento'

// SPEC-222 F1 (reunião Vinicius 22/10): "Pedido de compra avulso" — compra sem necessidade amarrada
// (estoque de giro, caixa fechada, fornecedor ofereceu desconto para fechar um valor). Qualquer produto do
// cadastro entra; o fechamento é o mesmo da Necessidade (ModalGerarCompraItemOrcamento), sem vínculo com L.
// Pedido amarrado a venda continua sendo montado na Necessidade de Compra.

const fmtQtd = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const lerQtd = (v: string) => parseFloat(v.replace(',', '.')) || 0

interface ItemAvulso {
  produto: EstoqueProdutoRow
  quantidade: string
}

export default function PedidoAvulso() {
  const { toast } = useToast()
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const [buscaForn, setBuscaForn] = useState('')
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])

  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<EstoqueProdutoRow[]>([])
  const [itens, setItens] = useState<ItemAvulso[]>([])
  const [fecharAberto, setFecharAberto] = useState(false)

  useEffect(() => {
    if (!buscaForn.trim()) {
      setFornecedores([])
      return
    }
    const t = setTimeout(() => {
      getFornecedores(buscaForn)
        .then(setFornecedores)
        .catch(() => setFornecedores([]))
    }, 300)
    return () => clearTimeout(t)
  }, [buscaForn])

  useEffect(() => {
    if (!busca.trim()) {
      setResultados([])
      return
    }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        setResultados(await buscarProdutosParaPedido(busca))
      } catch (err: any) {
        toast({ title: 'Erro na busca de produtos', description: err?.message, variant: 'destructive' })
      } finally {
        setBuscando(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [busca, toast])

  function adicionar(p: EstoqueProdutoRow) {
    setItens((prev) =>
      prev.some((i) => i.produto.produto_id === p.produto_id) ? prev : [...prev, { produto: p, quantidade: '1' }],
    )
  }

  // memo: o modal de fechar refaz o formulário quando a lista de itens muda
  const linhasCarrinho: LinhaCarrinho[] = useMemo(() => {
    if (!fornecedor) return []
    return itens
      .filter((i) => lerQtd(i.quantidade) > 0)
      .map((i) => ({
        chave: `avulso:${i.produto.produto_id}`,
        projeto_item_id: null,
        produto_id: i.produto.produto_id,
        produto: i.produto.produto,
        produto_codigo: i.produto.produto_codigo,
        orcamento_numero: null,
        l_fixo: null,
        pendente_item: lerQtd(i.quantidade),
        preco_custo: i.produto.custo_total || i.produto.preco_custo,
        fornecedor_id: fornecedor.id,
        fornecedor_nome: fornecedor.nome,
        empresa_id: null,
        empresa_nome: null,
      }))
  }, [fornecedor, itens])

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Pedido de compra avulso
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Compra sem venda amarrada (estoque, caixa fechada, oferta do fornecedor) — qualquer produto do
          cadastro. Para comprar o que as vendas precisam, use a Necessidade de Compra.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
            <Label>1. Fornecedor *</Label>
            {fornecedor ? (
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium">{fornecedor.nome}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFornecedor(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="relative max-w-md">
                <Input
                  placeholder="Buscar fornecedor..."
                  value={buscaForn}
                  onChange={(e) => setBuscaForn(e.target.value)}
                />
                {buscaForn.trim() && fornecedores.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-56">
                    {fornecedores.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setFornecedor(f)
                          setBuscaForn('')
                        }}
                      >
                        {f.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-slate-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="2. Buscar produto por nome, código, referência ou marca..."
                  className="pl-9 h-9 bg-slate-50"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              {busca && (
                <Button variant="ghost" size="sm" onClick={() => setBusca('')}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="max-h-[55vh] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="text-xs w-[90px]">Código</TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs w-[120px]">Marca</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">Estoque</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">Disponível</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buscando ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : resultados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-400">
                        {busca.trim() ? 'Nenhum produto encontrado.' : 'Digite para buscar no cadastro.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    resultados.map((p) => {
                      const noPedido = itens.some((i) => i.produto.produto_id === p.produto_id)
                      return (
                        <TableRow key={p.produto_id}>
                          <TableCell className="font-mono text-xs">{p.produto_codigo ?? '—'}</TableCell>
                          <TableCell className="text-sm">
                            {p.produto}
                            {p.referencia && (
                              <span className="block text-[11px] text-slate-400">Ref: {p.referencia}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{p.marca ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmtQtd(p.estoque_total)}</TableCell>
                          <TableCell
                            className={cn(
                              'text-right text-sm tabular-nums',
                              p.estoque_disponivel < 0 ? 'text-red-600 font-semibold' : 'text-slate-700',
                            )}
                          >
                            {fmtQtd(p.estoque_disponivel)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={noPedido}
                              onClick={() => adicionar(p)}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              {noPedido ? 'No pedido' : 'Pôr'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4 space-y-3 h-fit lg:sticky lg:top-4">
          <p className="text-sm font-semibold text-emerald-900">
            Pedido em montagem {fornecedor ? `· ${fornecedor.nome}` : ''}
          </p>
          {itens.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {itens.map((i) => (
                <li key={i.produto.produto_id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-mono text-xs text-slate-400 mr-1">{i.produto.produto_codigo}</span>
                    <span className="line-clamp-2">{i.produto.produto}</span>
                  </div>
                  <Input
                    inputMode="decimal"
                    className={cn('h-8 w-20 text-right text-sm', lerQtd(i.quantidade) <= 0 && 'border-red-400')}
                    value={i.quantidade}
                    onChange={(e) =>
                      setItens((prev) =>
                        prev.map((x) =>
                          x.produto.produto_id === i.produto.produto_id ? { ...x, quantidade: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    onClick={() =>
                      setItens((prev) => prev.filter((x) => x.produto.produto_id !== i.produto.produto_id))
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!fornecedor && itens.length > 0 && (
            <p className="text-xs text-amber-700">Escolha o fornecedor para fechar o pedido.</p>
          )}
          <div className="flex justify-end gap-2">
            {itens.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setItens([])}>
                Limpar
              </Button>
            )}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!fornecedor || linhasCarrinho.length === 0}
              onClick={() => setFecharAberto(true)}
            >
              <PackageCheck className="w-4 h-4 mr-2" />
              Fechar pedido ({linhasCarrinho.length})
            </Button>
          </div>
        </div>
      </div>

      <ModalGerarCompraItemOrcamento
        open={fecharAberto}
        onOpenChange={setFecharAberto}
        itens={linhasCarrinho}
        fornecedorId={fornecedor?.id ?? ''}
        fornecedorNome={fornecedor?.nome ?? ''}
        onSuccess={() => {
          setFecharAberto(false)
          setItens([])
        }}
      />
    </div>
  )
}
