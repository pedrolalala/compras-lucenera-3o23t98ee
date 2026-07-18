import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/hooks/use-auth'
import NecessidadeCompra from './pages/NecessidadeCompra'
import EstoqueProdutos from './pages/EstoqueProdutos'
import Cotacoes from './pages/Cotacoes'
import Marcas from './pages/Marcas'
import EmBreve from './pages/EmBreve'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import { AppHeader } from './components/AppHeader'
import { ProtectedRoute } from './components/ProtectedRoute'

const AppShell = () => {
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  if (isLoginRoute) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="w-full max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<NecessidadeCompra />} />
            <Route path="/necessidade-compra" element={<NecessidadeCompra />} />
            <Route path="/estoque" element={<EstoqueProdutos />} />
            <Route path="/marcas" element={<Marcas />} />
            <Route path="/solicitacoes" element={<EmBreve titulo="Solicitações de Compra" />} />
            <Route path="/cotacoes" element={<Cotacoes />} />
            <Route path="/pedidos" element={<EmBreve titulo="Pedidos de Compra" />} />
            <Route path="/recebimento" element={<EmBreve titulo="Recebimento" />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="app-ui-theme">
    <AuthProvider>
      <BrowserRouter>
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <Sonner />
          <AppShell />
        </TooltipProvider>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
)

export default App
