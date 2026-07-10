import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import NecessidadeCompra from './pages/NecessidadeCompra'
import NotFound from './pages/NotFound'
import { AppHeader } from './components/AppHeader'

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="app-ui-theme">
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <Toaster />
        <Sonner />
        <div className="min-h-screen bg-slate-50">
          <AppHeader />
          <main className="w-full max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
            <Routes>
              <Route path="/" element={<NecessidadeCompra />} />
              <Route path="/necessidade-compra" element={<NecessidadeCompra />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </TooltipProvider>
    </BrowserRouter>
  </ThemeProvider>
)

export default App
