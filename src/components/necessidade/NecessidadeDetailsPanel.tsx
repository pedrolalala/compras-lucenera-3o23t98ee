import { ShoppingCart, Hash, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type NecessidadeCompraRow } from '@/services/necessidade-compra'

interface Props {
  produto: NecessidadeCompraRow | null
}

// SPEC-103 (parte 1, revisão 2): a compra por L não passa mais por este
// painel — o usuário testou o modal e o card lateral e pediu pra marcar
// direto na linha expandida "Ver projetos" (NecessidadeCompraDetalhe.tsx),
// no lugar onde já está acostumado a ver o detalhe por L. Este painel
// voltou a ser só o resumo do produto selecionado.
export function NecessidadeDetailsPanel({ produto }: Props) {
  if (!produto) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1">
        <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
          <ShoppingCart className="w-12 h-12 mb-4 text-slate-200" />
          <h3 className="font-medium text-slate-900 mb-1">Nenhum produto selecionado</h3>
          <p className="text-sm">Clique em um produto para ver o resumo de estoque.</p>
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

      <div className="px-4 sm:px-5 py-5 flex-1 flex flex-col items-center justify-center text-center gap-2">
        <ChevronRight className="w-8 h-8 text-slate-300" />
        <p className="text-sm text-slate-500">
          Pra comprar por item de orçamento (L), clique no número na coluna{' '}
          <span className="font-medium text-slate-700">Projetos</span> desta
          linha, na tabela ao lado, e marque os L's que quer incluir no
          pedido.
        </p>
      </div>
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
