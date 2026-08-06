import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ClipboardList } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  criarSolicitacaoCompra,
  getEmpresasSimples,
  type EmpresaSimples,
} from '@/services/solicitacoes-compra'
import type { NecessidadeCompraRow } from '@/services/necessidade-compra'

// SPEC-066 Frente F: "Solicitações" — passo opcional entre a Necessidade
// de Compra (soma todas as empresas) e o pedido efetivo. Não substitui o
// "Comprar"/"Fechar Pedido em Lote" direto (P-F2), é um caminho a mais.

export function SolicitarCompraDialog({
  open,
  onOpenChange,
  produto,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: NecessidadeCompraRow | null
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [empresas, setEmpresas] = useState<EmpresaSimples[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [perfil, setPerfil] = useState<string>('nenhum')
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      getEmpresasSimples()
        .then(setEmpresas)
        .catch(() => {})
      setEmpresaId('')
      setPerfil('nenhum')
      setQuantidade(produto ? String(produto.necessidade_compra) : '')
      setObservacao('')
    }
  }, [open, produto])

  async function handleSalvar() {
    if (!produto || !quantidade || Number(quantidade) <= 0) {
      toast({ title: 'Informe uma quantidade válida', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await criarSolicitacaoCompra({
        produto_id: produto.produto_id,
        marca_id: produto.marca_id,
        fornecedor_id: produto.fornecedor_id,
        empresa_id: empresaId || null,
        perfil: perfil === 'nenhum' ? null : perfil,
        quantidade: Number(quantidade),
        observacao: observacao.trim() || null,
      })
      toast({
        title: 'Solicitação criada',
        description: 'Aparece agora em "Solicitações" para aprovação.',
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar solicitação',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  if (!produto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4 text-primary" />
            Solicitar Compra
          </DialogTitle>
          <DialogDescription>
            {produto.produto} — vai para "Solicitações" aguardando aprovação, em vez de virar
            pedido direto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm">Quantidade</Label>
            <Input
              type="number"
              step="0.001"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Empresa (opcional agora, decide na aprovação)</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar depois" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Perfil</Label>
            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                <SelectItem value="ribeirao">Ribeirão</SelectItem>
                <SelectItem value="sao_paulo">São Paulo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Observação (opcional)</Label>
            <Textarea
              rows={2}
              className="resize-none text-sm"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
