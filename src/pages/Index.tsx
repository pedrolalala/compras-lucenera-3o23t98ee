import { Plus } from 'lucide-react'

export default function Index() {
  return (
    <div className="group relative flex flex-col items-center justify-center w-full max-w-2xl mx-auto text-center animate-in fade-in duration-[800ms] zoom-in-[0.98] ease-out fill-mode-both">
      {/* Core Typography Section */}
      <div className="space-y-6 transition-transform duration-700 ease-apple group-hover:-translate-y-4">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground/90 leading-tight">
          Sua tela está pronta.
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Comece a criar algo incrível. Uma fundação sólida, limpa e responsiva aguarda suas ideias.
        </p>
      </div>

      {/* Interactive Reveal Element */}
      <div className="absolute top-[60%] left-1/2 -translate-x-1/2 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-4 transition-all duration-500 delay-100 ease-apple pointer-events-none">
        <div className="flex items-center justify-center bg-background text-muted-foreground rounded-full p-4 border border-border/40 shadow-elevation backdrop-blur-md">
          <Plus className="w-5 h-5 animate-pulse text-primary/70" />
        </div>
      </div>
    </div>
  )
}
