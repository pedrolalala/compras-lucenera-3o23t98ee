import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, X, Search, Plus, UserPlus, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  getFornecedoresDaMarca,
  vincularFornecedorAMarca,
  desvincularFornecedorDaMarca,
  type FornecedorDaMarca,
} from '@/services/marcas'
import {
  getEmailsFornecedor,
  getFornecedores,
  salvarEmailsFornecedor,
  type Fornecedor,
} from '@/services/pedido-compra'
import { FornecedorModal } from '@/components/fornecedores/FornecedorModal'
import type { Fornecedor as FornecedorCompleto } from '@/services/fornecedores'

// SPEC-066 Frente B: painel expansível listando TODOS os fornecedores
// (contatos.marca_id) vinculados a esta marca — 1 marca pode ter vários
// fornecedores/CNPJs diferentes (ex. "Metal Spot" via "Metal
// Estrangemar", "Metal Benaluti"...). Distinto do campo único legado
// marcas.fornecedor_id (edição inline já existente na tabela de Marcas).

export function FornecedoresDaMarcaPanel({ marcaId }: { marcaId: string }) {
  const { toast } = useToast()
  const [fornecedores, setFornecedores] = useState<FornecedorDaMarca[]>([])
  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Fornecedor[]>([])
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // SPEC-222 G2: e-mails do fornecedor (os do "Enviar ao fornecedor") editados aqui também — mudou o contato
  // na marca, troca aqui e o próximo pedido já vai certo.
  const [emailsDe, setEmailsDe] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailAlt, setEmailAlt] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)

  async function abrirEmails(f: FornecedorDaMarca) {
    if (emailsDe === f.id) {
      setEmailsDe(null)
      return
    }
    setEmailsDe(f.id)
    setEmail('')
    setEmailAlt('')
    try {
      const e = await getEmailsFornecedor(f.id)
      setEmail(e.email)
      setEmailAlt(e.email_alternativo)
    } catch {
      // silencioso — campos ficam vazios
    }
  }

  async function salvarEmails() {
    if (!emailsDe) return
    setSalvandoEmail(true)
    try {
      await salvarEmailsFornecedor(emailsDe, { email: email.trim(), email_alternativo: emailAlt.trim() })
      toast({ title: 'E-mails do fornecedor salvos' })
      setEmailsDe(null)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar os e-mails', description: err?.message, variant: 'destructive' })
    } finally {
      setSalvandoEmail(false)
    }
  }

  async function carregar() {
    setLoading(true)
    try {
      const data = await getFornecedoresDaMarca(marcaId)
      setFornecedores(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar fornecedores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcaId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!busca.trim()) {
      setResultados([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await getFornecedores(busca)
        setResultados(data.filter((f) => !fornecedores.some((fm) => fm.id === f.id)))
      } catch {
        // silencioso
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busca, fornecedores])

  async function adicionar(f: Fornecedor) {
    setSalvandoId(f.id)
    try {
      await vincularFornecedorAMarca(f.id, marcaId)
      setBusca('')
      setResultados([])
      await carregar()
      toast({ title: 'Fornecedor vinculado', description: `${f.nome} adicionado à marca.` })
    } catch (err: any) {
      toast({
        title: 'Erro ao vincular',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoId(null)
    }
  }

  async function aoCriarFornecedor(f: FornecedorCompleto) {
    setModalAberto(false)
    await adicionar({ id: f.id, nome: f.nome })
  }

  async function remover(f: FornecedorDaMarca) {
    setSalvandoId(f.id)
    try {
      await desvincularFornecedorDaMarca(f.id)
      await carregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoId(null)
    }
  }

  return (
    <div className="bg-slate-50/70 border-t border-slate-100 p-4 space-y-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Fornecedores desta marca (1 fornecedor = 1 marca; esta marca pode ter vários)
      </p>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      ) : fornecedores.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Nenhum fornecedor vinculado ainda.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {fornecedores.map((f) => (
            <li
              key={f.id}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-3 pr-1.5 py-1 text-sm text-slate-700"
            >
              {f.nome}
              <button
                type="button"
                title="E-mails para enviar pedido"
                onClick={() => abrirEmails(f)}
                className="text-slate-400 hover:text-primary rounded-full p-0.5 hover:bg-primary/10"
              >
                <Mail className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={salvandoId === f.id}
                onClick={() => remover(f)}
                className="text-slate-400 hover:text-red-600 rounded-full p-0.5 hover:bg-red-50"
              >
                {salvandoId === f.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {emailsDe && (
        <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-medium text-slate-600">
            E-mails de {fornecedores.find((f) => f.id === emailsDe)?.nome} para enviar pedido (vários: separe com ;)
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              className="h-8 text-sm"
              placeholder="vendas@fornecedor.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              className="h-8 text-sm"
              placeholder="Outro e-mail (opcional)"
              value={emailAlt}
              onChange={(e) => setEmailAlt(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEmailsDe(null)} disabled={salvandoEmail}>
              Fechar
            </Button>
            <Button size="sm" onClick={salvarEmails} disabled={salvandoEmail}>
              {salvandoEmail && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Salvar e-mails
            </Button>
          </div>
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input
          placeholder="Adicionar fornecedor..."
          className="h-8 pl-8 text-sm"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {(buscando || resultados.length > 0 || busca.trim()) && busca.trim() && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-52">
            {buscando ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                {resultados.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800 border-b border-slate-100 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      adicionar(f)
                    }}
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    {f.nome}
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-emerald-50 text-emerald-700 font-medium"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setModalAberto(true)
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Cadastrar novo fornecedor "{busca.trim()}"
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <FornecedorModal
        open={modalAberto}
        onOpenChange={setModalAberto}
        nomeInicial={busca.trim()}
        onSuccess={aoCriarFornecedor}
      />
    </div>
  )
}
