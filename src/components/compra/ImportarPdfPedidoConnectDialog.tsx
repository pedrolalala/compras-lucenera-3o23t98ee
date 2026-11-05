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
import { FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { lerPdfPedidoConnect, type PedidoPdf } from '@/lib/pdf-pedido-connect'
import { importarPedidoConnectPdf, type ResultadoPdf } from '@/services/importar-pedidos-connect'

// SPEC-247 fase 2: importar o PDF do pedido de compra da Connect (com as peças).

function brl(n: number | null | undefined) {
  return n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Ficha {
  arquivo: string
  pedido?: PedidoPdf
  previa?: ResultadoPdf
  erro?: string
  importado?: boolean
}

const ROTULO_ACAO: Record<string, string> = {
  criar: 'Pedido novo: será criado com as peças',
  completar: 'Pedido já existe sem peças: as peças serão preenchidas nele',
  ja_tem_itens: 'Este pedido já tem peças no sistema — ignorado',
  pedido_fechado: 'Este pedido está cancelado/concluído — ignorado',
  sem_fornecedor: 'Fornecedor sem cadastro — cadastre-o antes',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportado: () => void
}

export function ImportarPdfPedidoConnectDialog({ open, onOpenChange, onImportado }: Props) {
  const { toast } = useToast()
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)

  function fechar(aberto: boolean) {
    if (gravando) return
    if (!aberto) setFichas([])
    onOpenChange(aberto)
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!arquivos.length) return
    setLendo(true)
    setFichas([])
    const lista: Ficha[] = []
    for (const f of arquivos) {
      try {
        const pedido = await lerPdfPedidoConnect(f)
        if (!pedido.itens.length || pedido.numero == null || !pedido.fornecedor) {
          lista.push({ arquivo: f.name, pedido, erro: pedido.avisos.join(' ') || 'Não consegui ler este PDF.' })
        } else {
          const previa = await importarPedidoConnectPdf(pedido, false) // prévia: não grava nada
          lista.push({ arquivo: f.name, pedido, previa })
        }
      } catch (err: any) {
        lista.push({ arquivo: f.name, erro: err?.message ?? 'Não consegui ler este PDF.' })
      }
      setFichas([...lista])
    }
    setLendo(false)
  }

  // o que o PDF leu de errado (soma, item ilegível) bloqueia: melhor não importar do que importar torto
  const pdfComProblema = (f: Ficha) => (f.pedido?.avisos.length ?? 0) > 0
  const podeImportar = (f: Ficha) =>
    !!f.previa && !f.previa.bloqueado && !pdfComProblema(f) && !f.importado && !f.erro
  const importaveis = fichas.filter(podeImportar)

  async function confirmar() {
    setGravando(true)
    let ok = 0
    const falhas: string[] = []
    const novas = [...fichas]
    for (let i = 0; i < novas.length; i++) {
      const f = novas[i]
      if (!podeImportar(f) || !f.pedido) continue
      try {
        const r = await importarPedidoConnectPdf(f.pedido, true)
        if (r.aplicado) {
          ok++
          novas[i] = { ...f, importado: true }
        } else {
          falhas.push(`${r.numero}: não foi gravado (${ROTULO_ACAO[r.acao] ?? r.acao})`)
        }
      } catch (err: any) {
        falhas.push(`${f.arquivo}: ${err?.message ?? 'erro'}`)
      }
    }
    setFichas(novas)
    setGravando(false)
    if (ok > 0) onImportado()
    toast({
      title: `${ok} pedido(s) importado(s)`,
      description: falhas.length ? falhas.join(' · ') : 'As peças já aparecem na Entrada de Nota Fiscal.',
      variant: falhas.length ? 'destructive' : 'default',
    })
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar pedido da Connect (PDF)</DialogTitle>
          <DialogDescription>
            Escolha um ou mais PDFs de pedido de compra da Connect. O sistema lê as peças (código,
            quantidade e valor), mostra o que vai acontecer e só grava quando você confirmar. O PDF não
            sai do seu computador. Nada vai para o Contas a Pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-slate-500" />
            <Input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={escolher}
              disabled={lendo || gravando}
            />
          </label>

          {lendo && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Lendo os PDFs...
            </p>
          )}

          {fichas.map((f) => {
            const p = f.pedido
            const r = f.previa
            const problema = pdfComProblema(f)
            const ok = podeImportar(f)
            return (
              <div
                key={f.arquivo}
                className={`rounded-md border p-3 text-sm space-y-2 ${
                  f.importado ? 'border-green-300 bg-green-50' : ok ? 'bg-white' : 'border-amber-300 bg-amber-50'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    {p?.numero ? `Pedido ${p.numero}` : f.arquivo}
                    {p?.fornecedor && <span className="font-normal text-slate-600"> · {p.fornecedor}</span>}
                  </p>
                  {p && (
                    <p className="text-xs text-slate-500">
                      {p.itens.length} peça(s) · {brl(p.total)}
                      {p.empresa && <> · {p.empresa}</>}
                    </p>
                  )}
                </div>

                {f.erro && <p className="text-xs text-red-700">{f.erro}</p>}

                {f.importado && <p className="text-xs text-green-700 font-medium">Importado.</p>}

                {r && !f.importado && (
                  <p className={`text-xs font-medium ${ok ? 'text-slate-700' : 'text-amber-900'}`}>
                    {ROTULO_ACAO[r.acao] ?? r.acao}
                  </p>
                )}

                {r && r.pecas_nao_cadastradas.length > 0 && (
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">Peças que não existem no cadastro (cadastre e tente de novo):</p>
                    <ul className="list-disc ml-5">
                      {r.pecas_nao_cadastradas.map((x) => (
                        <li key={x.codigo}>
                          código {x.codigo}
                          {x.referencia ? ` · ref. ${x.referencia}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {problema && (
                  <div className="text-xs text-red-700">
                    <p className="font-semibold">O PDF não bate — confira antes de importar:</p>
                    <ul className="list-disc ml-5">
                      {p!.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {r && r.avisos.length > 0 && (
                  <ul className="list-disc ml-5 text-xs text-amber-900">
                    {r.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}

                {p && p.itens.length > 0 && !f.importado && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-600">Ver as {p.itens.length} peças lidas</summary>
                    <div className="mt-1 max-h-48 overflow-y-auto rounded border">
                      <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1">Código</th>
                            <th className="text-left px-2 py-1">Referência</th>
                            <th className="text-left px-2 py-1">Descrição</th>
                            <th className="text-right px-2 py-1">Qtd</th>
                            <th className="text-right px-2 py-1">Vl. unit.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.itens.map((i) => (
                            <tr key={i.item} className="border-t">
                              <td className="px-2 py-1 font-mono">{i.codigo_produto}</td>
                              <td className="px-2 py-1">{i.referencia}</td>
                              <td className="px-2 py-1">{i.descricao}</td>
                              <td className="px-2 py-1 text-right font-mono">
                                {i.quantidade.toLocaleString('pt-BR')} {i.un}
                              </td>
                              <td className="px-2 py-1 text-right font-mono">{brl(i.valor_unitario)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => fechar(false)} disabled={gravando}>
            Fechar
          </Button>
          <Button onClick={confirmar} disabled={gravando || lendo || importaveis.length === 0}>
            {gravando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importar {importaveis.length > 0 ? `${importaveis.length} pedido(s)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
