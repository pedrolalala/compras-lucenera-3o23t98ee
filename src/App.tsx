import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import NecessidadeCompra from './pages/NecessidadeCompra'
import NotFound from './pages/NotFound'
import { AuthProvider, useAuth } from './hooks/use-auth'
import Login from './pages/Login'

const ProtectedRoutes = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/necessidade-compra" replace />} />
        <Route path="/necessidade-compra" element={<NecessidadeCompra />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ProtectedRoutes />
      </TooltipProvider>
    </BrowserRouter>
  </AuthProvider>
)

export default App
