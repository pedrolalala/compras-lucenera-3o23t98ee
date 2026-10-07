import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import { AppNav } from './AppNav'

export function ProtectedRoute() {
  const { user, hasAccess, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (hasAccess === false) {
    return (
      <div className="flex items-center justify-center h-[60vh] p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <h1 className="text-lg font-semibold">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta não tem permissão para acessar a Necessidade de Compra. Fale com um
            administrador se acredita que isso é um engano.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <AppNav />
      <Outlet />
    </>
  )
}
