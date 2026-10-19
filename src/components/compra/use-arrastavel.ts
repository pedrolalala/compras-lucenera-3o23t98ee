import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

// SPEC-209 A5: arrastar a janela (Dialog) pelo título para ver a tela de trás — ex.: conferir de
// qual empresa é a venda sem fechar o pedido. Usa a propriedade CSS `translate`, que se soma ao
// `transform` de centralização do Dialog. Volta ao centro quando `chave` muda (outra janela aberta).
export function useArrastavel(chave?: unknown) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const inicio = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  useEffect(() => {
    setPos({ x: 0, y: 0 })
  }, [chave])

  const mover = useCallback((e: PointerEvent) => {
    const i = inicio.current
    if (!i) return
    setPos({ x: i.x + e.clientX - i.px, y: i.y + e.clientY - i.py })
  }, [])

  const soltar = useCallback(() => {
    inicio.current = null
    window.removeEventListener('pointermove', mover)
    window.removeEventListener('pointerup', soltar)
  }, [mover])

  useEffect(() => soltar, [soltar])

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    const alvo = e.target as HTMLElement
    if (alvo.closest('button, input, textarea, select, a, [role="combobox"]')) return
    inicio.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    e.preventDefault()
  }

  const estilo: CSSProperties = { translate: `${pos.x}px ${pos.y}px` }

  return {
    estilo,
    alca: {
      onPointerDown,
      className: 'cursor-move select-none',
      title: 'Arraste para mover a janela',
    },
  }
}
