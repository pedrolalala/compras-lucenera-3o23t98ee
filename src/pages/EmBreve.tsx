import { Construction } from 'lucide-react'

interface Props {
  titulo: string
  descricao?: string
}

export default function EmBreve({ titulo, descricao }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in-up">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <Construction className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">{titulo}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {descricao ?? 'Esta funcionalidade está em desenvolvimento e estará disponível em breve.'}
          </p>
        </div>
      </div>
    </div>
  )
}
