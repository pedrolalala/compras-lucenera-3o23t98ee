import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Hash, Package, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type NecessidadeCompraRow } from '@/services/necessidade-compra'
import { ModalGerarCompraItemOrcamento } from '@/components/compra/ModalGerarCompraItemOrcamento'
import {
  SelecionarLParaCompraModal,
  type ItemComCliente,
} from './SelecionarLParaCompraModal'

interface Props {
  produto: NecessidadeCompraRow | null
  // SPEC-103 (parte 1): notifica a tela pai (lista "Por Produto") depois de
  // gerar uma compra por L aqui dentro, pra recarregar pendente/necessidade.
  onPurchased?: () => void
}

// SPEC-103 (parte 1, revisão): o card lateral tentou embutir a lista de L's
// direto aqui e o usuário achou confuso (espaço apertado pra escolher entre
// vários L's/clientes). Virou um botão que abre um modal de verdade
// (SelecionarLParaCompraModal.tsx) — este painel agora só mostra o resumo do
// produto e o atalho pra abrir a seleção.
export function NecessidadeDetailsPanel({ produto, onPurchased }: Props) {
  const [selecionarOpen, setSelecionarOpen] = useState(false)
  const [modalCompraOpen, setModalCompraOpen] = useState(false)
  const [itensParaComprar, setItensParaComprar] = useState<ItemComCliente[]>([])
  const [fornecedorId, setFornecedorId] = useState('')
  const [fornecedorNome, setFornecedorNome] = useState('')

  function handleConfirmarSelecao(
    itens: ItemComCliente[],
    fId: string,
    fNome: string,
  ) {
    setItensParaComprar(itens)
    setFornecedorId(fId)
    setFornecedorNome(fNome)
    setSelecionarOpen(false)
    setModalCompraOpen(true)
  }

  if (!produto) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1">
        <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
          <ShoppingCart className="w-12 h-12 mb-4 text-slate-200" />
          <h3 className="font-medium text-slate-900 mb-1">Nenhum produto selecionado</h3>
          <p className="text-sm">Clique em um produto para comprar por item de orçamento (L).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1 min-w-0 flex flex-col">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 shrink-0">
        <h3 className="font-semibold text-slate-900 leading-tight break-words">
          {produto.produto}
        </h3>
        {produto.produto_codigo && (
          <div className="flex items-center gap-1.5 mt-1">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-xs text-slate-600">{produto.produto_codigo}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatCard label="Física" value={produto.qtd_fisica} color="slate" />
          <StatCard label="Comprometida" value={produto.qtd_comprometida} color="amber" />
          <StatCard label="Necessidade" value={produto.necessidade_compra} color="red" />
        </div>
      </div>

      <div className="px-4 sm:px-5 py-5 flex flex-col gap-3 flex-1">
        <h4 className="text-sm font-semibold flex items-center text-slate-700">
          <Package className="w-4 h-4 mr-2 text-slate-400" />
          Comprar por Item (L)
        </h4>
        <p className="text-xs text-slate-500">
          Escolha visualmente quais L's/clientes deste produto entram no pedido de
          compra — abre num painel maior, mais fácil de comparar vários de uma vez.
        </p>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setSelecionarOpen(true)}
        >
          <PackageCheck className="w-4 h-4 mr-2" />
          Selecionar L's pra comprar
        </Button>
        {produto.projetos_com_entrega_futura > 0 && (
          <p className="text-xs text-slate-400">
            {produto.projetos_com_entrega_futura} projeto(s) com entrega futura pendente.
          </p>
        )}
      </div>

      <SelecionarLParaCompraModal
        open={selecionarOpen}
        onOpenChange={setSelecionarOpen}
        produto={produto}
        onConfirmar={handleConfirmarSelecao}
      />

      <ModalGerarCompraItemOrcamento
        open={modalCompraOpen}
        onOpenChange={setModalCompraOpen}
        itens={itensParaComprar}
        fornecedorId={fornecedorId}
        fornecedorNome={fornecedorNome}
        onSuccess={() => {
          setModalCompraOpen(false)
          setItensParaComprar([])
          onPurchased?.()
        }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'slate' | 'amber' | 'red'
}) {
  const colorMap = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <div className={cn('rounded-lg px-2 py-1.5 text-center', colorMap[color])}>
      <p className="text-[10px] font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold leading-none mt-0.5">{value}</p>
    </div>
  )
}
