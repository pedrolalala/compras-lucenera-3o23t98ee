import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/hooks/use-auth'
import { AppHeader } from './components/AppHeader'
import { AvisoChegadaPedidos } from './components/compra/AvisoChegadaPedidos'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SystemSwitcher } from './components/SystemSwitcher'

// SPEC-123: code-splitting por rota (mesmo padrão já em produção no RH,
// dashboard-rh-lucenera-5fe9c/src/App.tsx).
const NecessidadeCompra = lazy(() => import('./pages/NecessidadeCompra'))
// SPEC-222 F1/F2: "Estoque" virou o Pedido de compra avulso; a aba Cotações saiu (desconto fica no pedido)
const PedidoAvulso = lazy(() => import('./pages/PedidoAvulso'))
const Marcas = lazy(() => import('./pages/Marcas'))
const PedidosCompra = lazy(() => import('./pages/PedidosCompra'))
const EntradaNotaFiscal = lazy(() => import('./pages/EntradaNotaFiscal'))
const Login = lazy(() => import('./pages/Login'))
const NotFound = lazy(() => import('./pages/NotFound'))

const LoadingFallback = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
)

const AppShell = () => {
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'
  // SPEC-039: Necessidade de Compra full-width/full-height — sem o limite de
  // 1600px/padding aplicado por padrão a todas as rotas.
  const isFullWidthRoute = location.pathname === '/' || location.pathname === '/necessidade-compra'

  if (isLoginRoute) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <AppHeader />
      <AvisoChegadaPedidos />
      <main
        className={cn(
          'w-full flex-1 min-h-0',
          isFullWidthRoute
            ? 'flex flex-col overflow-hidden'
            : // SPEC-222: as outras abas com a mesma largura (tela inteira) e o mesmo espaçamento da Necessidade
              'overflow-y-auto px-4 md:px-6 py-3',
        )}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<NecessidadeCompra />} />
              <Route path="/necessidade-compra" element={<NecessidadeCompra />} />
              <Route path="/pedido-avulso" element={<PedidoAvulso />} />
              <Route path="/estoque" element={<Navigate to="/pedido-avulso" replace />} />
              <Route path="/marcas" element={<Marcas />} />
              {/* SPEC-209 D1: "Solicitações" deixou de existir; tudo fica em Pedidos. */}
              <Route path="/solicitacoes" element={<Navigate to="/pedidos" replace />} />
              <Route path="/cotacoes" element={<Navigate to="/pedidos" replace />} />
              <Route path="/pedidos" element={<PedidosCompra />} />
              <Route path="/recebimento" element={<EntradaNotaFiscal />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <SystemSwitcher currentSlug="necessidade-de-compra" />
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
