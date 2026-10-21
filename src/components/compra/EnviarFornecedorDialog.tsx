import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  getEmailsFornecedor,
  getNomeUsuario,
  salvarEmailsFornecedor,
  type PedidoCompraRow,
} from '@/services/pedido-compra'
import {
  assuntoPadrao,
  baixarEmailPedido,
  emailValido,
  separarEmails,
  textoPadrao,
} from '@/lib/email-pedido-fornecedor'
import { nomeArquivoPedido } from '@/lib/pdf-pedido-fornecedor'

// SPEC-214: "Enviar ao fornecedor" — confere os e-mails (o que for digitado fica no cadastro do
// fornecedor), o assunto e o texto, e baixa o e-mail pronto (.eml) com o PDF anexado. Ao abrir o
// arquivo, o Outlook clássico mostra o e-mail novo, é só clicar em Enviar.
export function EnviarFornecedorDialog({
  pedido,
  onClose,
}: {
  pedido: PedidoCompraRow | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [carregando, setCarregando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [email, setEmail] = useState('')
  const [emailAlt, setEmailAlt] = useState('')
  const [original, setOriginal] = useState({ email: '', email_alternativo: '' })
  const [assunto, setAssunto] = useState('')
  const [texto, setTexto] = useState('')

  useEffect(() => {
    if (!pedido) return
    let ativo = true
    setCarregando(true)
    Promise.all([
      getEmailsFornecedor(pedido.fornecedor_id),
      user?.id ? getNomeUsuario(user.id) : Promise.resolve(null),
    ])
      .then(([emails, nome]) => {
        if (!ativo) return
        setOriginal(emails)
        setEmail(emails.email)
        setEmailAlt(emails.email_alternativo)
        setAssunto(assuntoPadrao(pedido.numero, pedido.empresa_nome))
        setTexto(textoPadrao(pedido.numero, pedido.empresa_nome, nome))
      })
      .catch((err: any) => {
        toast({
          title: 'Erro ao carregar os e-mails do fornecedor',
          description: err?.message ?? 'Tente novamente.',
          variant: 'destructive',
        })
      })
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [pedido, user?.id, toast])

  const para = [...separarEmails(email), ...separarEmails(emailAlt)]
  const invalidos = para.filter((e) => !emailValido(e))

  async function enviar() {
    if (!pedido) return
    setGerando(true)
    try {
      const mudou =
        email.trim() !== original.email.trim() ||
        emailAlt.trim() !== original.email_alternativo.trim()
      if (mudou) {
        try {
          await salvarEmailsFornecedor(pedido.fornecedor_id, {
            email: email.trim(),
            email_alternativo: emailAlt.trim(),
          })
          setOriginal({ email: email.trim(), email_alternativo: emailAlt.trim() })
        } catch (err: any) {
          toast({
            title: 'Os e-mails não foram gravados no cadastro',
            description: err?.message ?? 'O e-mail vai ser gerado mesmo assim.',
            variant: 'destructive',
          })
        }
      }
      await baixarEmailPedido(pedido.id, { para, assunto, texto })
      toast({
        title: 'E-mail pronto',
        description: 'Abra o arquivo baixado: o Outlook abre o e-mail com o PDF anexado.',
      })
      onClose()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar o e-mail',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setGerando(false)
    }
  }

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && !gerando && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar ao fornecedor — pedido {pedido?.numero}</DialogTitle>
          <DialogDescription>
            {pedido?.fornecedor_nome}. Vai ser baixado um e-mail pronto com o PDF anexado; abra o
            arquivo e o Outlook mostra o e-mail, é só clicar em Enviar.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="env-email">E-mail do fornecedor</Label>
                <Input
                  id="env-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendas@fornecedor.com.br"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="env-email-alt">Outro e-mail (opcional)</Label>
                <Input
                  id="env-email-alt"
                  value={emailAlt}
                  onChange={(e) => setEmailAlt(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">
              Mais de um e-mail no mesmo campo: separe com ponto e vírgula. O que mudar aqui fica
              gravado no cadastro do fornecedor.
            </p>
            {invalidos.length > 0 && (
              <p className="text-xs text-red-600">E-mail inválido: {invalidos.join(', ')}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="env-assunto">Assunto</Label>
              <Input id="env-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="env-texto">Texto</Label>
              <Textarea
                id="env-texto"
                rows={10}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            {pedido && (
              <p className="text-xs text-slate-500">
                Anexo: {nomeArquivoPedido(pedido.numero, pedido.fornecedor_nome)}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={gerando}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={carregando || gerando || para.length === 0 || invalidos.length > 0}
          >
            {gerando ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-1" />
            )}
            Abrir no Outlook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
