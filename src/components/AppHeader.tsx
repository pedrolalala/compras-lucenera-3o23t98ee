import { ShoppingCart } from 'lucide-react'
import logoUrl from '@/assets/lucenera-vertical-d5520.png'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-8 shadow-sm">
      <div className="flex items-center gap-4">
        <img src={logoUrl} alt="Lucenera" className="h-8 w-auto object-contain" />
        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="font-semibold text-base sm:text-lg text-slate-800">
            Necessidade de Compra
          </span>
          <span className="hidden sm:inline text-sm text-slate-400 ml-2">Estoque · Compras</span>
        </div>
      </div>
    </header>
  )
}
