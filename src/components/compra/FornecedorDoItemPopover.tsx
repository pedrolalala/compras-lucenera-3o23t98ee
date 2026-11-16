// SPEC-317: trocar o fornecedor de um produto no pedido em montagem (Necessidade de Compra),
// como no Pedido Avulso — busca por nome entre todos os fornecedores cadastrados.
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getFornecedores, type Fornecedor } from '@/services/pedido-compra'
import { cn } from '@/lib/utils'

export function FornecedorDoItemPopover({
  nome,
  onEscolher,
}: {
  nome: string
  onEscolher: (f: Fornecedor) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<Fornecedor[]>([])

  useEffect(() => {
    if (!aberto || !busca.trim()) {
      setLista([])
      return
    }
    const t = setTimeout(() => {
      getFornecedores(busca)
        .then(setLista)
        .catch(() => setLista([]))
    }, 300)
    return () => clearTimeout(t)
  }, [aberto, busca])

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-7 max-w-[240px] truncate text-xs', !nome && 'border-red-300 text-red-700')}
        >
          {nome || 'Escolher fornecedor'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <Input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar fornecedor..."
          className="h-8 text-sm"
        />
        <div className="mt-2 max-h-48 overflow-auto">
          {lista.map((f) => (
            <button
              key={f.id}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
              onClick={() => {
                onEscolher(f)
                setAberto(false)
                setBusca('')
              }}
            >
              {f.nome}
            </button>
          ))}
          {busca.trim() && lista.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-500">Nenhum fornecedor encontrado.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
