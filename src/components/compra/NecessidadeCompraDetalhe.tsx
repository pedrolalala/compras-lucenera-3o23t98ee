import { useState, useEffect } from 'react'
import { Loader2, PackageCheck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  getNecessidadeCompraDetalhe,
  type NecessidadeCompraDetalheRow,
} from '@/services/necessidade-compra-detalhe'
import {
  getPedidosAbertosPorProduto,
  traduzirStatusPedidoCompra,
  type PedidoCompraAbertoRow,
} from '@/services/necessidade-compra'
import {
  getNecessidadeCompraItemPorProduto,
  type NecessidadeCompraItemRow,
} from '@/services/necessidade-compra-item'
import { ModalGerarCompraItemOrcamento } from '@/components/compra/ModalGerarCompraItemOrcamento'

interface Props {
  produtoId: string
  // SPEC-103 (parte 1, revisão 2): notifica a tela pai depois de gerar uma
  // compra por L aqui dentro, pra recarregar pendente/necessidade.
  onPurchased?: () => void
}

// SPEC-103 (parte 1, revisão 2): a seleção por L não fica mais num modal
// separado — o usuário testou e pediu pra marcar direto aqui, na própria
// linha expandida "Ver projetos" (feedback: um lugar a mais só confundia).
// `vw_necessidade_compra_detalhe` (fonte desta tabela) não tem L/fornecedor/
// custo — só as linhas que ainda têm saldo pendente de fato (depois de
// descontar pedido de compra já aberto) aparecem em
// `vw_necessidade_compra_item_orcamento`; junta as duas por
// projeto_item_id. Linha sem correspondência = já coberta por pedido aberto,
// checkbox fica desabilitado.
interface RowComItem extends NecessidadeCompraDetalheRow {
  item?: NecessidadeCompraItemRow
}

export function NecessidadeCompraDetalhe({ produtoId, onPurchased }: Props) {
  const [rows, setRows] = useState<RowComItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalCompraOpen, setModalCompraOpen] = useState(false)

  // SPEC-039 (P-01): painel expansível também lista os pedidos de compra
  // abertos deste produto, ao lado dos projetos com entrega futura.
  const [pedidos, setPedidos] = useState<PedidoCompraAbertoRow[]>([])
  const [loadingPedidos, setLoadingPedidos] = useState(true)
  const [errorPedidos, setErrorPedidos] = useState(false)

  function loadRows() {
    setLoading(true)
    setError(false)
    Promise.all([
      getNecessidadeCompraDetalhe(produtoId),
      getNecessidadeCompraItemPorProduto(produtoId),
    ])
      .then(([detalheRows, itemRows]) => {
        const itemMap = new Map(itemRows.map((it) => [it.projeto_item_id, it]))
        setRows(
          detalheRows.map((r) => ({ ...r, item: itemMap.get(r.projeto_item_id) })),
        )
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRows()
    setSelectedIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId])

  useEffect(() => {
    setLoadingPedidos(true)
    setErrorPedidos(false)
    getPedidosAbertosPorProduto(produtoId)
      .then(setPedidos)
      .catch(() => setErrorPedidos(true))
      .finally(() => setLoadingPedidos(false))
  }, [produtoId])

  function toggleSelect(projetoItemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(projetoItemId)) next.delete(projetoItemId)
      else next.add(projetoItemId)
      return next
    })
  }

  const selectedItens = rows
    .filter((r) => selectedIds.has(r.projeto_item_id) && r.item)
    .map((r) => r.item as NecessidadeCompraItemRow)
  // fornecedor_id é resolvido por produto/marca — igual em todas as linhas
  // deste produto.
  const fornecedorId = selectedItens[0]?.fornecedor_id ?? ''
  const fornecedorNome = selectedItens[0]?.fornecedor_nome ?? ''

  return (
    <div className="bg-slate-50/70 border-b border-slate-100 divide-y divide-slate-100">
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Carregando projetos...</span>
          </div>
        ) : error ? (
          <div className="py-3 px-6 text-xs text-red-500">
            Erro ao carregar detalhes. Tente novamente.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-3 px-6 text-xs text-slate-400 italic">
            Nenhum projeto vinculado com saldo ativo.
          </div>
        ) : (
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="h-8 bg-slate-100/80 hover:bg-slate-100/80">
                <TableHead className="pl-6 w-[5%]" />
                <TableHead className="w-[19%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Projeto
                </TableHead>
                <TableHead className="w-[11%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Orçamento
                </TableHead>
                <TableHead className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Para quem vai
                </TableHead>
                {/* SPEC-103 (parte 2): empresa que originou a venda — visibilidade,
                    sem regra automática de qual empresa deve comprar. */}
                <TableHead className="w-[12%] hidden md:table-cell text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Empresa
                </TableHead>
                <TableHead className="w-[10%] hidden lg:table-cell text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Vendido
                </TableHead>
                {/* SPEC-104: "Coberto" renomeado pra "Reservado" — mesmo
                    termo já usado no card de peça do Cadastro (SPEC-101),
                    pra não ter dois nomes pro mesmo conceito (q_reserva). */}
                <TableHead className="w-[10%] hidden xl:table-cell text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Reservado
                </TableHead>
                <TableHead className="w-[10%] pr-4 sm:pr-6 text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  A Comprar
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const checked = selectedIds.has(r.projeto_item_id)
                const podeComprar = !!r.item
                return (
                  <TableRow
                    key={r.projeto_item_id}
                    className={cn(
                      'h-10 border-b border-slate-100/60 hover:bg-slate-100/40',
                      checked && 'bg-primary/5',
                    )}
                  >
                    <TableCell className="pl-6 align-middle py-1.5">
                      <Checkbox
                        checked={checked}
                        disabled={!podeComprar}
                        onCheckedChange={() => toggleSelect(r.projeto_item_id)}
                        title={
                          podeComprar
                            ? undefined
                            : 'Sem saldo pendente de compra (já coberto por pedido em aberto, ou sem fornecedor resolvido)'
                        }
                      />
                    </TableCell>
                    <TableCell className="align-middle py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        {r.projeto_codigo && (
                          <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold">
                            {r.projeto_codigo}
                          </span>
                        )}
                        {r.item?.l_fixo && (
                          <span className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-semibold">
                            {r.item.l_fixo}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 truncate block">
                        {r.projeto_nome ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle py-1.5">
                      <span className="text-xs text-slate-500">{r.orcamento_numero ?? '—'}</span>
                    </TableCell>
                    <TableCell className="align-middle py-1.5">
                      <span className="text-xs text-slate-700 font-medium">{r.cliente ?? '—'}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell align-middle py-1.5">
                      <span className="text-xs text-slate-500">{r.empresa_nome ?? '—'}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right align-middle py-1.5">
                      <span className="text-xs text-slate-500 tabular-nums">{r.qtd_vendida}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right align-middle py-1.5">
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          r.q_reserva > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400',
                        )}
                      >
                        {r.q_reserva}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-6 text-right align-middle py-1.5">
                      <span
                        className={cn(
                          'text-xs tabular-nums font-semibold',
                          r.q_entrega_futura > 0 ? 'text-red-600' : 'text-slate-400',
                        )}
                      >
                        {r.q_entrega_futura}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-6 py-2 bg-emerald-50 border-t border-emerald-100">
            <span className="text-xs font-medium text-emerald-800">
              {selectedIds.size} L(s) selecionado(s)
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setModalCompraOpen(true)}
            >
              <PackageCheck className="w-3.5 h-3.5 mr-1.5" />
              Gerar Compra ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* SPEC-039 (P-01): pedidos de compra abertos deste produto (Empresa
          que comprou / Status do pedido / Data prevista de entrega, pedido a
          pedido). */}
      <div>
        <div className="pl-10 pr-4 sm:pr-6 pt-2 pb-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500">
          Pedidos de compra em aberto
        </div>
        {loadingPedidos ? (
          <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Carregando pedidos...</span>
          </div>
        ) : errorPedidos ? (
          <div className="py-3 px-6 text-xs text-red-500">
            Erro ao carregar pedidos de compra. Tente novamente.
          </div>
        ) : pedidos.length === 0 ? (
          <div className="py-3 px-6 pl-10 text-xs text-slate-400 italic">
            Nenhum pedido de compra em aberto para este produto.
          </div>
        ) : (
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="h-8 bg-slate-100/80 hover:bg-slate-100/80">
                <TableHead className="pl-10 w-[16%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Pedido
                </TableHead>
                <TableHead className="w-[16%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Empresa que comprou
                </TableHead>
                <TableHead className="w-[16%] text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                  Entrega prevista
                </TableHead>
                <TableHead className="w-[12%] text-right text-slate-500 font-semibold text-[10px] uppercase tracking-wide pr-4 sm:pr-6">
                  Qtd. pendente
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((pc) => (
                <TableRow
                  key={pc.pedido_id}
                  className="h-10 border-b border-slate-100/60 hover:bg-slate-100/40"
                >
                  <TableCell className="pl-10 align-middle py-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-semibold">
                      {pc.numero}
                    </span>
                  </TableCell>
                  <TableCell className="align-middle py-1.5">
                    <span className="text-xs text-slate-700">
                      {traduzirStatusPedidoCompra(pc.status)}
                    </span>
                  </TableCell>
                  <TableCell className="align-middle py-1.5">
                    <span className="text-xs text-slate-700 font-medium">
                      {pc.empresa_nome ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="align-middle py-1.5">
                    <span className="text-xs text-slate-500">
                      {pc.data_prevista_entrega
                        ? new Date(pc.data_prevista_entrega).toLocaleDateString('pt-BR')
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right align-middle py-1.5 pr-4 sm:pr-6">
                    <span className="text-xs tabular-nums font-semibold text-slate-700">
                      {pc.qtd_pendente}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ModalGerarCompraItemOrcamento
        open={modalCompraOpen}
        onOpenChange={setModalCompraOpen}
        itens={selectedItens}
        fornecedorId={fornecedorId}
        fornecedorNome={fornecedorNome}
        onSuccess={() => {
          setModalCompraOpen(false)
          setSelectedIds(new Set())
          loadRows()
          onPurchased?.()
        }}
      />
    </div>
  )
}
