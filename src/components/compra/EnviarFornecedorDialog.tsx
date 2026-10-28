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
  getCopiasPedidoCompra,
  getEmailsFornecedor,
  getNomeUsuario,
  salvarCopiasPedidoCompra,
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
import {
  getComprasConfig,
  getEntregaFornecedor,
  linhasEndereco,
  salvarEntregaFornecedor,
  type ComprasConfig,
  type EnderecoEntrega,
} from '@/services/compras-config'

const ENTREGA_VAZIA: EnderecoEntrega = {
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
}

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
  // SPEC-222 G1: cópias fixas de quem envia (gravadas no usuário)
  const [copias, setCopias] = useState('')
  const [copiasOriginal, setCopiasOriginal] = useState('')
  const [assunto, setAssunto] = useState('')
  const [texto, setTexto] = useState('')
  // SPEC-236: onde o fornecedor entrega — padrão (estoque) ou endereço próprio (ex.: showroom)
  const [config, setConfig] = useState<ComprasConfig | null>(null)
  const [entregaPropria, setEntregaPropria] = useState(false)
  const [entrega, setEntrega] = useState<EnderecoEntrega>(ENTREGA_VAZIA)
  const [entregaOriginal, setEntregaOriginal] = useState<EnderecoEntrega | null>(null)

  useEffect(() => {
    if (!pedido) return
    let ativo = true
    setCarregando(true)
    Promise.all([
      getEmailsFornecedor(pedido.fornecedor_id),
      user?.id ? getNomeUsuario(user.id) : Promise.resolve(null),
      user?.id ? getCopiasPedidoCompra(user.id) : Promise.resolve(''),
      getComprasConfig().catch(() => null),
      getEntregaFornecedor(pedido.fornecedor_id).catch(() => null),
    ])
      .then(([emails, nome, cc, cfg, propria]) => {
        if (!ativo) return
        setConfig(cfg)
        setEntregaOriginal(propria)
        setEntregaPropria(!!propria)
        setEntrega(propria ?? ENTREGA_VAZIA)
        setCopias(cc)
        setCopiasOriginal(cc)
        setOriginal(emails)
        setEmail(emails.email)
        setEmailAlt(emails.email_alternativo)
        setAssunto(assuntoPadrao(pedido.numero, pedido.empresa_nome))
        setTexto(textoPadrao(pedido.numero, pedido.empresa_nome, nome, cfg?.whatsapp))
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
  const copia = separarEmails(copias)
  const invalidos = [...para, ...copia].filter((e) => !emailValido(e))

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
      if (user?.id && copias.trim() !== copiasOriginal.trim()) {
        try {
          await salvarCopiasPedidoCompra(user.id, copias)
          setCopiasOriginal(copias)
        } catch (err: any) {
          toast({
            title: 'As cópias não foram gravadas',
            description: err?.message ?? 'O e-mail vai ser gerado mesmo assim.',
            variant: 'destructive',
          })
        }
      }
      // SPEC-236: grava o endereço de entrega do fornecedor antes de gerar o PDF (o PDF lê do cadastro)
      const novaEntrega = entregaPropria && entrega.logradouro.trim() ? entrega : null
      if (JSON.stringify(novaEntrega) !== JSON.stringify(entregaOriginal)) {
        try {
          await salvarEntregaFornecedor(pedido.fornecedor_id, novaEntrega)
          setEntregaOriginal(novaEntrega)
        } catch (err: any) {
          toast({
            title: 'O endereço de entrega não foi gravado no cadastro',
            description: err?.message ?? 'O e-mail vai ser gerado mesmo assim.',
            variant: 'destructive',
          })
        }
      }
      await baixarEmailPedido(pedido.id, { para, copia, assunto, texto })
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
            <div className="space-y-1">
              <Label htmlFor="env-copias">Cópia (sempre vai junto quando você envia)</Label>
              <Input
                id="env-copias"
                value={copias}
                onChange={(e) => setCopias(e.target.value)}
                placeholder="comercial@...; ronaldo@...; vinicius@..."
              />
              <p className="text-[11px] text-slate-500">
                Fica gravado no seu usuário para os próximos pedidos.
              </p>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <Label>Endereço de entrega no PDF</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={entregaPropria ? 'outline' : 'default'}
                  onClick={() => setEntregaPropria(false)}
                >
                  Padrão (estoque)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={entregaPropria ? 'default' : 'outline'}
                  onClick={() => setEntregaPropria(true)}
                >
                  Endereço próprio deste fornecedor
                </Button>
              </div>
              {!entregaPropria ? (
                <p className="text-xs text-slate-600">
                  {config?.padrao
                    ? [config.padrao.nome, ...linhasEndereco(config.padrao.endereco)].filter(Boolean).join(' — ')
                    : 'Endereço padrão não configurado.'}
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  <Input
                    className="col-span-4"
                    placeholder="Rua / avenida"
                    value={entrega.logradouro}
                    onChange={(e) => setEntrega({ ...entrega, logradouro: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="Número"
                    value={entrega.numero}
                    onChange={(e) => setEntrega({ ...entrega, numero: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    placeholder="Complemento"
                    value={entrega.complemento}
                    onChange={(e) => setEntrega({ ...entrega, complemento: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    placeholder="Bairro"
                    value={entrega.bairro}
                    onChange={(e) => setEntrega({ ...entrega, bairro: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    placeholder="Cidade"
                    value={entrega.cidade}
                    onChange={(e) => setEntrega({ ...entrega, cidade: e.target.value })}
                  />
                  <Input
                    className="col-span-1"
                    placeholder="UF"
                    value={entrega.estado}
                    onChange={(e) => setEntrega({ ...entrega, estado: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="CEP"
                    value={entrega.cep}
                    onChange={(e) => setEntrega({ ...entrega, cep: e.target.value })}
                  />
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Fica gravado no cadastro do fornecedor e vale para os próximos pedidos dele.
              </p>
            </div>
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
