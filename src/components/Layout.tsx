import { Outlet, Link } from 'react-router-dom'
import { ThemeToggle } from './theme-toggle'

export default function Layout() {
  return (
    <div className="relative flex flex-col min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/10 selection:text-primary transition-colors duration-500 ease-in-out">
      {/* Subtle Radial Gradient Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, hsl(var(--muted)) 0%, transparent 70%)',
        }}
      />

      {/* Header - Hidden by default, reveals on hover over the top edge */}
      <header className="absolute top-0 w-full h-20 flex-none px-6 flex justify-between items-center z-20 opacity-0 hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm">
        <Link
          to="/"
          className="text-sm font-semibold tracking-widest text-muted-foreground hover:text-foreground uppercase transition-colors"
        >
          Início
        </Link>
        <span className="text-xs font-medium text-muted-foreground/60">Página em Branco</span>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 py-24">
        <Outlet />
      </main>

      {/* Minimalist Footer */}
      <footer className="flex-none p-8 text-center z-10 opacity-70 hover:opacity-100 transition-opacity duration-300">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          v1.0.0 &middot; Desenvolvido com Skip
        </p>
      </footer>

      {/* Floating Action Button (Theme Toggle) */}
      <div className="fixed bottom-8 right-8 z-50">
        <ThemeToggle />
      </div>
    </div>
  )
}
