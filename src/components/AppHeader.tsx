import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, LogOut, LogIn, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/hooks/use-auth'
import logoUrl from '@/assets/lucenera-vertical-d5520.png'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-white px-4 md:px-8 shadow-sm">
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

      <nav className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className={cn('text-slate-600 hover:text-slate-900 hover:bg-slate-100')}
        >
          <Link to="/">
            <Home className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Início</span>
          </Link>
        </Button>

        {user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-slate-600 hover:text-primary hover:bg-primary/5"
          >
            <Link to="/login">
              <LogIn className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Entrar</span>
            </Link>
          </Button>
        )}

        <div className="ml-1">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
