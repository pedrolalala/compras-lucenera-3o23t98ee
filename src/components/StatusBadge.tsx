import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  aberta: 'bg-blue-100 text-blue-700',
  em_cotacao: 'bg-amber-100 text-amber-700',
  em_andamento: 'bg-amber-100 text-amber-700',
  pedido_gerado: 'bg-purple-100 text-purple-700',
  cancelada: 'bg-red-100 text-red-700',
  cancelado: 'bg-red-100 text-red-700',
  rascunho: 'bg-slate-100 text-slate-600',
  aprovado: 'bg-green-100 text-green-700',
  enviado: 'bg-blue-100 text-blue-700',
  parcialmente_recebido: 'bg-orange-100 text-orange-700',
  recebido: 'bg-green-100 text-green-700',
  rejeitado: 'bg-red-100 text-red-700',
  // SPEC-038 Item 4: status de pedido_compra_parcelas
  pendente: 'bg-amber-100 text-amber-700',
  pago: 'bg-green-100 text-green-700',
  atrasado: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
        statusColors[status] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}
