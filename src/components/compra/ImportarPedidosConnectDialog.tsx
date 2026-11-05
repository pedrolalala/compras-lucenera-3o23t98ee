import { useState } from 'react'
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
import { Loader2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  importarPedidosConnect,
  lerPlanilhaPedidosConnect,
  type PedidoConnectLinha,
  type PreviaImportacao,
} from '@/services/importar-pedidos-connect'

// SPEC-247: importar pedidos da Connect (planilha PedidoCompra_*.xlsx) — só cabeçalho, sem itens.

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportado: () => void
}

export function ImportarPedidosConnectDialog({ open, onOpenChange, onImportado }: Props) {
  const { toast } = useToast()
  const [arquivo, setArquivo] = useState('')
  const [pedidos, setPedidos] = useState<PedidoConnectLinha[] | null>(null)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState('')

  function limpar() {
    setArquivo('')
    setPedidos(null)
    setPrevia(null)
    setErro('')
  }

  function fechar(aberto: boolean) {
    if (gravando) return
    if (!aberto) limpar()
    onOpenChange(aberto)
  }

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    limpar()
    setArquivo(f.name)
    setLendo(true)
    try {
      const lidos = await lerPlanilhaPedidosConnect(f)
      const r = await importarPedidosConnect(lidos, false) // prévia: não grava nada
      setPedidos(lidos)
      setPrevia(r)
    } catch (err: any) {
      setErro(err?.message ?? 'Não consegui ler a planilha.')
    } finally {
      setLendo(false)
    }
  }

  async function confirmar() {
    if (!pedidos) return
    setGravando(true)
    try {
      const r = await importarPedidosConnect(pedidos, true)
      toast({
        title: `${r.inseridos} pedido(s) importado(s)`,
        description:
          'Entraram só com fornecedor e valor (sem as peças). Para dar entrada agora, use a entrada avulsa.',
      })
      onImportado()
      fechar(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao importar',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setGravando(false)
    }
  }

  const totalNovos = previa?.novos.reduce((s, p) => s + Number(p.valor), 0) ?? 0
  const duplicados = previa?.novos.filter((p) => p.duplicado) ?? []

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar pedidos da Connect</DialogTitle>
          <DialogDescription>
            Escolha a planilha <strong>PedidoCompra_….xlsx</strong> exportada da Connect. Os pedidos
            entram com fornecedor e valor, <strong>sem as peças</strong>; nada vai para o Contas a
            Pagar. Você confere o resultado antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4 text-slate-500" />
            <Input
              type="file"
              accept=".xlsx"
              onChange={escolherArquivo}
              disabled={lendo || gravando}
            />
          </label>

          {lendo && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Lendo {arquivo}...
            </p>
          )}

          {erro && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {previa && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">{arquivo}</p>
                <ul className="mt-1 space-y-0.5 text-slate-700">
                  <li>
                    <strong>{previa.novos.length}</strong> pedido(s) novo(s) para importar
                    {previa.novos.length > 0 && <> · {brl(totalNovos)}</>}
                  </li>
                  <li>
                    <strong>{previa.ja_existem.length}</strong> já existem no sistema (serão ignorados)
                  </li>
                  <li>
                    <strong>{previa.sem_fornecedor.length}</strong> sem cadastro de fornecedor (não
                    serão importados)
                  </li>
                </ul>
              </div>

              {previa.novos.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1">Pedido</th>
                        <th className="text-left px-2 py-1">Fornecedor</th>
                        <th className="text-left px-2 py-1">Emissão</th>
                        <th className="text-right px-2 py-1">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.novos.map((p) => (
                        <tr key={p.codigo} className="border-t">
                          <td className="px-2 py-1 font-mono">{p.codigo} CONNECT</td>
                          <td className="px-2 py-1">{p.fornecedor}</td>
                          <td className="px-2 py-1">
                            {p.emissao.split('-').reverse().join('/')}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">{brl(Number(p.valor))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previa.sem_fornecedor.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold mb-1">
                    Cadastre estes fornecedores no Cadastro e importe a planilha de novo:
                  </p>
                  <ul className="space-y-0.5">
                    {previa.sem_fornecedor.map((p) => (
                      <li key={p.codigo}>
                        Pedido {p.codigo} · {p.fornecedor} · {brl(Number(p.valor))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {duplicados.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  {duplicados.length} pedido(s) são de fornecedor com <strong>cadastro duplicado</strong>{' '}
                  ({Array.from(new Set(duplicados.map((p) => p.fornecedor))).join(', ')}). Foi usado o
                  cadastro que já tem mais pedidos; vale unificar no Cadastro.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => fechar(false)} disabled={gravando}>
            Fechar
          </Button>
          <Button onClick={confirmar} disabled={gravando || lendo || !previa || previa.novos.length === 0}>
            {gravando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importar {previa?.novos.length ? `${previa.novos.length} pedido(s)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
