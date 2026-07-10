import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Hexagon } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('pedro@lucenera.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await signIn(email, password)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-fade-in">
      <Card className="w-full max-w-sm border-slate-200 shadow-sm">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="flex justify-center mb-2">
            <Hexagon className="w-14 h-14 text-amber-500 fill-amber-500/10" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Lucenera
          </CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
