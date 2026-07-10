import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: Rota não encontrada:', location.pathname)
  }, [location.pathname])

  return (
    <div className="flex flex-col items-center justify-center animate-in fade-in duration-[800ms] zoom-in-[0.98] ease-out">
      <div className="text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-5xl font-medium tracking-tighter text-foreground/90">404</h1>
          <p className="text-muted-foreground tracking-widest uppercase text-xs font-medium">
            Página não encontrada
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1.5" />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

export default NotFound
