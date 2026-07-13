import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/hooks/use-auth'
import NecessidadeCompra from './pages/NecessidadeCompra'
import EstoqueProdutos from './pages/EstoqueProdutos'
import EmBreve from './pages/EmBreve'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import { AppHeader } from './components/AppHeader'
import { AppNav } from './components/AppNav'
import { ProtectedRoute } from './components/ProtectedRoute'

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="app-ui-theme">
    <AuthProvider>
      <BrowserRouter>
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <Sonner />
          <div className="min-h-screen bg-slate-50">
            <AppHeader />
            <AppNav />
            <main className="w-full max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<NecessidadeCompra />} />
                  <Route path="/necessidade-compra" element={<NecessidadeCompra />} />
                  <Route path="/estoque" element={<EstoqueProdutos />} />
                  <Route path="/solicitacoes" element={<EmBreve titulo="Solicitações de Compra" />} />
                  <Route path="/cotacoes" element={<EmBreve titulo="Cotações" />} />
                  <Route path="/pedidos" element={<EmBreve titulo="Pedidos de Compra" />} />
                  <Route path="/recebimento" element={<EmBreve titulo="Recebimento" />} />
                </Route>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </TooltipProvider>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
)

export default App
