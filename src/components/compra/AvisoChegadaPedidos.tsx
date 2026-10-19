import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getPedidosChegando, type PedidoChegando } from '@/services/pedido-compra'

// SPEC-209 C3 (pedido das meninas na reunião de 19/10): ao abrir o sistema de Compras, avisa os
// pedidos que chegam nos próximos 10 dias, para confirmar com o fornecedor antes de o cliente
// precisar. Aparece uma vez por dia por pessoa; a lista fica sempre visível na tela Pedidos.

function hojeIso() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function diasAte(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const hoje = new Date()
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
  return Math.round((new Date(a, m - 1, d).getTime() - base) / 86400000)
}

export function AvisoChegadaPedidos() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoChegando[]>([])
  const [aberto, setAberto] = useState(false)
  const [chave, setChave] = useState('')

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const uid = data.session?.user?.id
        if (!uid) return
        const k = `aviso-chegada-pedidos:${uid}:${hojeIso()}`
        try {
          if (localStorage.getItem(k)) return
        } catch {
          // navegador sem armazenamento: mostra mesmo assim
        }
        const lista = await getPedidosChegando(10)
        if (cancelado || lista.length === 0) return
        setChave(k)
        setPedidos(lista)
        setAberto(true)
      } catch {
        // aviso é secundário: nunca atrapalha a tela
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  function fechar() {
    setAberto(false)
    try {
      if (chave) localStorage.setItem(chave, '1')
    } catch {
      // ignora
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-600" />
            Pedidos chegando nos próximos 10 dias
          </DialogTitle>
          <DialogDescription>Confirme com o fornecedor se a entrega está mantida.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm">
          {pedidos.map((p) => {
            const dias = diasAte(p.data_prevista_entrega)
            return (
              <li
                key={p.id}
                className="flex justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <span>
                  <span className="font-mono font-semibold">#{p.numero}</span> · {p.fornecedor_nome}
                </span>
                <span className="whitespace-nowrap text-amber-900 font-medium">
                  {p.data_prevista_entrega.split('-').reverse().join('/')} (
                  {dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`})
                </span>
              </li>
            )
          })}
        </ul>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={fechar}>
            Ok, entendi
          </Button>
          <Button
            onClick={() => {
              fechar()
              navigate('/pedidos')
            }}
          >
            Ver pedidos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
