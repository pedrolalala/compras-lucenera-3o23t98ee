import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Package, FileText, Quote, ShoppingCart, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Necessidade de Compra', icon: LayoutDashboard },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { to: '/cotacoes', label: 'Cotações', icon: Quote },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/recebimento', label: 'Recebimento', icon: PackageCheck },
]

export function AppNav() {
  const location = useLocation()

  return (
    <nav className="border-b bg-white px-4 md:px-8">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50',
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
