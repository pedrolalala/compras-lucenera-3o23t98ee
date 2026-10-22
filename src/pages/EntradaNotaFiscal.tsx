import { Fragment, useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Search,
  FileText,
  Loader2,
  Paperclip,
  ExternalLink,
  RefreshCw,
  ArrowRightLeft,
  Ban,
  Users,
  ScrollText,
} from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  buscarPedidoPorNumero,
  buscarProdutosParaEntrada,
  cancelarEntradaNotaCompra,
  criarNotaFiscalCompra,
  datasDasParcelas,
  formatarDocumento,
  getAntecipacoesParaEntrada,
  getDocumentoFornecedor,
  getEntregasFuturas,
  getNotasFiscaisCompra,
  registrarEntradaNotaCompra,
  type AntecipacaoEntrada,
  type EntregaFutura,
  type PedidoParaEntrada,
  type NotaFiscalCompraRow,
  type ProdutoBusca,
} from '@/services/notas-fiscais-compra'
import {
  getFornecedores,
  getEmpresas,
  type Fornecedor,
  type Empresa,
} from '@/services/pedido-compra'
import { traduzirStatusPedidoCompra } from '@/services/necessidade-compra'
import {
  FinanceiroNotaEntrada,
  dividirParcelas,
  lerValor,
  type ParcelaNota,
} from '@/components/compra/FinanceiroNotaEntrada'
import {
  VinculoClientesDialog,
  lerQtd,
  sugerirVinculos,
} from '@/components/compra/VinculoClientesDialog'
import { EspelhoEntradaDialog } from '@/components/compra/EspelhoEntradaDialog'

const hoje = () => new Date().toISOString().slice(0, 10)
const r2 = (n: number) => Math.round(n * 100) / 100
// SPEC-220: valores da nota por unidade, por peça (sem IPI/ST no valor unitário)
interface ValoresPeca {
  vu: string
  ipi: string
  st: string
}
function fmtBRL(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

const fmtQtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

type ItemEntrada = PedidoParaEntrada['itens'][number]

// SPEC-213: a mesma peça de vários L vira uma linha só (soma do pedido, do que já chegou e do que falta).
function agruparPorPeca(itens: ItemEntrada[]) {
  const grupos = new Map<string, ItemEntrada[]>()
  for (const it of itens) grupos.set(it.produto_id, [...(grupos.get(it.produto_id) ?? []), it])
  return Array.from(grupos.entries()).map(([produto_id, lista]) => ({
    produto_id,
    produto_nome: lista[0].produto_nome,
    produto_codigo: lista[0].produto_codigo,
    itens: lista,
    quantidade: lista.reduce((s, i) => s + i.quantidade, 0),
    qtd_recebida: lista.reduce((s, i) => s + i.qtd_recebida, 0),
    falta: lista.reduce((s, i) => s + Math.max(0, i.quantidade - i.qtd_recebida), 0),
  }))
}

export default function EntradaNotaFiscal() {
  const { toast } = useToast()

  // SPEC-088: "pedido" é o fluxo original (localizar pedido de compra
  // existente); "avulsa" é pra compras que chegaram fisicamente sem nunca
  // ter passado por um pedido formal no sistema.
  const [modo, setModo] = useState<'pedido' | 'avulsa'>('pedido')

  const [numeroPedido, setNumeroPedido] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [pedido, setPedido] = useState<PedidoParaEntrada | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  // SPEC-209 E: quanto chegou agora de cada peça (começa com o que falta chegar).
  // SPEC-213: chave = produto_id — a mesma peça de vários L é uma linha só.
  const [chegou, setChegou] = useState<Record<string, string>>({})

  const [fornecedorBusca, setFornecedorBusca] = useState('')
  const [fornecedorResultados, setFornecedorResultados] = useState<Fornecedor[]>([])
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<Fornecedor | null>(null)
  const [buscandoFornecedor, setBuscandoFornecedor] = useState(false)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')

  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtoResultados, setProdutoResultados] = useState<ProdutoBusca[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoBusca | null>(null)
  const [buscandoProduto, setBuscandoProduto] = useState(false)

  const [numeroNf, setNumeroNf] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)

  // SPEC-215: fornecedor da nota (quando veio em nome de outro: o pedido passa a ser dele), ST, parcelas
  // editáveis e pagamento antecipado vinculado.
  const [fornecedorNota, setFornecedorNota] = useState<
    { id: string; nome: string; documento: string | null } | null
  >(null)
  const [trocandoFornecedor, setTrocandoFornecedor] = useState(false)
  const [buscaFornNota, setBuscaFornNota] = useState('')
  const [resultadosFornNota, setResultadosFornNota] = useState<Fornecedor[]>([])
  const [valorEditado, setValorEditado] = useState(false)
  const [valorSt, setValorSt] = useState('')
  const [stEditado, setStEditado] = useState(false)
  const [parcelas, setParcelas] = useState<ParcelaNota[]>([])
  const [parcelasEditadas, setParcelasEditadas] = useState(false)
  const [antecipacoes, setAntecipacoes] = useState<AntecipacaoEntrada[]>([])
  const [usar, setUsar] = useState<Record<string, string>>({})

  // SPEC-220 (reunião Vinicius 21/10): valores por item, dados da nota, vínculo com o cliente e espelho.
  const [valoresPeca, setValoresPeca] = useState<Record<string, ValoresPeca>>({})
  const [chaveAcesso, setChaveAcesso] = useState('')
  const [dataEntrega, setDataEntrega] = useState(hoje)
  const [dataEntrada, setDataEntrada] = useState(hoje)
  const [desconto, setDesconto] = useState('')
  const [despesasAcessorias, setDespesasAcessorias] = useState('')
  const [entregas, setEntregas] = useState<EntregaFutura[]>([])
  const [vinculos, setVinculos] = useState<Record<string, Record<string, string>>>({})
  const [vinculosEditados, setVinculosEditados] = useState<Record<string, boolean>>({})
  const [pecaVinculo, setPecaVinculo] = useState<string | null>(null)
  const [espelhoNotaId, setEspelhoNotaId] = useState<string | null>(null)

  const [historico, setHistorico] = useState<NotaFiscalCompraRow[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(true)

  // SPEC-218: cancelar uma entrada lançada sem querer (desfaz quantidades, status, A Pagar e antecipação).
  const [notaParaCancelar, setNotaParaCancelar] = useState<NotaFiscalCompraRow | null>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando] = useState(false)

  const carregarHistorico = useCallback(async () => {
    setLoadingHistorico(true)
    try {
      const data = await getNotasFiscaisCompra()
      setHistorico(data)
    } catch {
      // silencioso — histórico não é crítico pro fluxo principal
    } finally {
      setLoadingHistorico(false)
    }
  }, [])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  async function handleConfirmCancel() {
    if (!notaParaCancelar || !motivoCancelamento.trim()) return
    setCancelando(true)
    try {
      const res = await cancelarEntradaNotaCompra(notaParaCancelar.id, motivoCancelamento)
      const devolvido = Number(res.antecipacao_devolvida) || 0
      const partes = [
        res.pedido_numero
          ? `Pedido ${res.pedido_numero} voltou para "${traduzirStatusPedidoCompra(res.pedido_status)}".`
          : null,
        'As parcelas da nota saíram do Contas a Pagar.',
        devolvido > 0 ? `${fmtBRL(devolvido)} de pagamento antecipado voltou a ter saldo.` : null,
        Number(res.reserva_desfeita) > 0
          ? `${fmtQtd(Number(res.reserva_desfeita))} peça(s) voltaram da reserva para a entrega futura.`
          : null,
      ]
      toast({
        title: `Entrada da NF ${notaParaCancelar.numero_nf} cancelada`,
        description: partes.filter(Boolean).join(' '),
      })
      // o pedido aberto no formulário mudou (quantidade recebida/status): fecha para buscar de novo
      if (pedido && pedido.numero === notaParaCancelar.pedido_numero) setPedido(null)
      setNotaParaCancelar(null)
      await carregarHistorico()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar a entrada',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCancelando(false)
    }
  }

  useEffect(() => {
    getEmpresas()
      .then(setEmpresas)
      .catch(() => {
        // silencioso — select fica vazio, usuário percebe ao tentar salvar
      })
  }, [])

  useEffect(() => {
    if (modo !== 'avulsa' || !fornecedorBusca.trim()) {
      setFornecedorResultados([])
      return
    }
    const t = setTimeout(async () => {
      setBuscandoFornecedor(true)
      try {
        const data = await getFornecedores(fornecedorBusca)
        setFornecedorResultados(data)
      } catch {
        // silencioso
      } finally {
        setBuscandoFornecedor(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [modo, fornecedorBusca])

  useEffect(() => {
    if (!trocandoFornecedor || !buscaFornNota.trim()) {
      setResultadosFornNota([])
      return
    }
    const t = setTimeout(() => {
      getFornecedores(buscaFornNota)
        .then(setResultadosFornNota)
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [trocandoFornecedor, buscaFornNota])

  // SPEC-215: antecipações com saldo do fornecedor do pedido, do fornecedor da nota ou ligadas ao pedido.
  useEffect(() => {
    if (!pedido) {
      setAntecipacoes([])
      return
    }
    getAntecipacoesParaEntrada(pedido.id, fornecedorNota?.id)
      .then((lista) => {
        setAntecipacoes(lista)
        setUsar((u) =>
          Object.fromEntries(Object.entries(u).filter(([id]) => lista.some((a) => a.id === id))),
        )
      })
      .catch(() => setAntecipacoes([]))
  }, [pedido, fornecedorNota?.id])

  useEffect(() => {
    if (modo !== 'avulsa' || !produtoBusca.trim()) {
      setProdutoResultados([])
      return
    }
    const t = setTimeout(async () => {
      setBuscandoProduto(true)
      try {
        const data = await buscarProdutosParaEntrada(produtoBusca)
        setProdutoResultados(data)
      } catch {
        // silencioso
      } finally {
        setBuscandoProduto(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [modo, produtoBusca])

  async function buscarPedido(e?: React.FormEvent) {
    e?.preventDefault()
    if (!numeroPedido.trim()) return
    setBuscando(true)
    setNaoEncontrado(false)
    setPedido(null)
    try {
      const result = await buscarPedidoPorNumero(numeroPedido.trim())
      if (result) {
        setPedido(result)
        setChegou(
          Object.fromEntries(
            agruparPorPeca(result.itens).map((g) => [g.produto_id, String(g.falta)]),
          ),
        )
        setValor(result.valor_total != null ? Number(result.valor_total).toFixed(2) : '')
        // SPEC-220: valores da nota já preenchidos do pedido (por peça; sem IPI/ST no valor unitário)
        setValoresPeca(
          Object.fromEntries(
            agruparPorPeca(result.itens).map((g) => {
              const i = g.itens[0]
              const vu = i.custo_liquido ?? Math.max(0, i.custo_unitario - i.valor_ipi - i.valor_st)
              const q4 = (n: number) => String(Math.round(n * 10000) / 10000)
              return [g.produto_id, { vu: q4(vu), ipi: q4(i.valor_ipi), st: q4(i.valor_st) }]
            }),
          ),
        )
        setVinculos({})
        setVinculosEditados({})
        getEntregasFuturas(Array.from(new Set(result.itens.map((i) => i.produto_id))))
          .then(setEntregas)
          .catch(() => setEntregas([]))
      } else {
        setNaoEncontrado(true)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao buscar pedido',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBuscando(false)
    }
  }

  function limparFormulario() {
    setPedido(null)
    setChegou({})
    setNumeroPedido('')
    setFornecedorSelecionado(null)
    setFornecedorBusca('')
    setEmpresaId('')
    setProdutoSelecionado(null)
    setProdutoBusca('')
    setNumeroNf('')
    setDataEmissao('')
    setValor('')
    setObservacao('')
    setArquivo(null)
    setFornecedorNota(null)
    setTrocandoFornecedor(false)
    setBuscaFornNota('')
    setValorEditado(false)
    setValorSt('')
    setStEditado(false)
    setParcelas([])
    setParcelasEditadas(false)
    setUsar({})
    setValoresPeca({})
    setChaveAcesso('')
    setDataEntrega(hoje())
    setDataEntrada(hoje())
    setDesconto('')
    setDespesasAcessorias('')
    setEntregas([])
    setVinculos({})
    setVinculosEditados({})
  }

  function trocarModo(novo: 'pedido' | 'avulsa') {
    setModo(novo)
    limparFormulario()
  }

  // SPEC-209 E: pedido cancelado ou já concluído não recebe entrada.
  const pedidoFechado = !!pedido && ['cancelado', 'recebido'].includes(pedido.status)
  // SPEC-213: o que chegou de cada peça é repartido entre as linhas (L) dela, na ordem do pedido:
  // completa o que falta no primeiro L, depois no seguinte.
  const pecas = agruparPorPeca(pedido?.itens ?? [])
  const lerChegou = (produtoId: string) =>
    parseFloat((chegou[produtoId] ?? '').replace(',', '.')) || 0
  const pecasAMais = pecas.filter((g) => lerChegou(g.produto_id) > g.falta)
  const itensChegando = pecas
    .flatMap((g) => {
      let resta = lerChegou(g.produto_id)
      return g.itens.map((it) => {
        const q = Math.min(resta, Math.max(0, it.quantidade - it.qtd_recebida))
        resta -= q
        return { pedido_item_id: it.id, quantidade: Math.round(q * 1000) / 1000 }
      })
    })
    .filter((it) => it.quantidade > 0)
  const podeRegistrar =
    modo === 'pedido'
      ? !!pedido && !pedidoFechado && itensChegando.length > 0 && pecasAMais.length === 0
      : !!fornecedorSelecionado

  // SPEC-220: totais da nota pelos itens (o que chegou × valores da nota): produtos + IPI + ST − desconto
  // + despesas acessórias. As "outras despesas" do pedido (ICMS recolhido depois) não entram na nota.
  const valoresDe = (produtoId: string) => {
    const v = valoresPeca[produtoId]
    return { vu: lerValor(v?.vu ?? ''), ipi: lerValor(v?.ipi ?? ''), st: lerValor(v?.st ?? '') }
  }
  const totaisItens = pecas.reduce(
    (t, g) => {
      const q = Math.min(lerChegou(g.produto_id), g.falta)
      const v = valoresDe(g.produto_id)
      return { produtos: t.produtos + q * v.vu, ipi: t.ipi + q * v.ipi, st: t.st + q * v.st }
    },
    { produtos: 0, ipi: 0, st: 0 },
  )
  const totalCalculado = r2(
    r2(totaisItens.produtos) + r2(totaisItens.ipi) + r2(totaisItens.st) - lerValor(desconto) + lerValor(despesasAcessorias),
  )
  useEffect(() => {
    if (modo !== 'pedido' || !pedido) return
    if (!valorEditado) setValor(totalCalculado > 0 ? totalCalculado.toFixed(2) : '')
    if (!stEditado) setValorSt(totaisItens.st > 0 ? r2(totaisItens.st).toFixed(2) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, pedido, totalCalculado, totaisItens.st, valorEditado, stEditado])

  // SPEC-220: para quem vai o que chegou — sugestão pelos L de origem do pedido até a pessoa mexer.
  const chaveChegou = JSON.stringify(chegou)
  useEffect(() => {
    if (modo !== 'pedido' || !pedido) return
    setVinculos((atual) => {
      const novo = { ...atual }
      for (const g of pecas) {
        if (vinculosEditados[g.produto_id]) continue
        novo[g.produto_id] = sugerirVinculos(
          Math.min(lerChegou(g.produto_id), g.falta),
          g.itens.flatMap((i) => i.origens),
          entregas.filter((e) => e.produto_id === g.produto_id),
        )
      }
      return novo
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, pedido, chaveChegou, entregas, vinculosEditados])

  const vinculadoDe = (produtoId: string) =>
    Object.values(vinculos[produtoId] ?? {}).reduce((s, x) => s + lerQtd(x), 0)
  const vinculosOk = pecas.every((g) => {
    const chegaAgora = Math.min(lerChegou(g.produto_id), g.falta)
    if (vinculadoDe(g.produto_id) > chegaAgora + 0.0001) return false
    return Object.entries(vinculos[g.produto_id] ?? {}).every(([pi, x]) => {
      const e = entregas.find((en) => en.projeto_item_id === pi)
      return !!e && lerQtd(x) >= 0 && lerQtd(x) <= e.q_entrega_futura + 0.0001
    })
  })
  const chaveDigitos = chaveAcesso.replace(/\D/g, '')
  const chaveOk = chaveDigitos.length === 0 || chaveDigitos.length === 44

  const valorNota = lerValor(valor)
  const stNota = lerValor(valorSt)
  const totalBate = Math.abs(valorNota - totalCalculado) <= 0.01
  const usado = Object.values(usar).reduce((s, v) => s + lerValor(v), 0)

  async function refazerParcelas() {
    if (!pedido) return
    const restante = valorNota - usado
    if (restante <= 0.005) {
      setParcelas([])
      return
    }
    const base = dataEmissao || new Date().toISOString().slice(0, 10)
    let datas: string[] = []
    try {
      datas = await datasDasParcelas(pedido.condicoes_pagamento, pedido.prazo_pagamento_dias, base)
    } catch {
      // sem condição legível: 1 parcela em 30 dias, editável
    }
    if (datas.length === 0) {
      const d = new Date(base + 'T12:00')
      d.setDate(d.getDate() + 30)
      datas = [d.toISOString().slice(0, 10)]
    }
    setParcelas(dividirParcelas(restante, stNota, datas))
  }

  useEffect(() => {
    if (modo === 'pedido' && pedido && !parcelasEditadas) refazerParcelas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, pedido, valorNota, stNota, usado, dataEmissao, parcelasEditadas])

  const somaParcelas = parcelas.reduce((s, p) => s + lerValor(p.valor), 0)
  const antecipacaoAcima = antecipacoes.some((a) => lerValor(usar[a.id] ?? '') > a.saldo + 0.001)
  const financeiroOk =
    valorNota > 0 &&
    !antecipacaoAcima &&
    usado <= valorNota + 0.001 &&
    Math.abs(valorNota - usado - somaParcelas) <= 0.01 &&
    parcelas.every((p) => p.data_vencimento && lerValor(p.valor) > 0)
  // SPEC-220: só registra com o total dos itens batendo com a nota, vínculos dentro do limite e chave válida
  const entradaOk = financeiroOk && totalBate && vinculosOk && chaveOk

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeRegistrar || !numeroNf.trim()) return
    if (modo === 'pedido' && !entradaOk) return
    setSalvando(true)
    try {
      // SPEC-215: com pedido, quantidades + nota + parcelas + antecipação vão juntos numa RPC só
      // (o banco confere o que falta chegar e muda o status do pedido).
      if (modo === 'pedido' && pedido) {
        const produtoDoItem = new Map(pedido.itens.map((i) => [i.id, i.produto_id]))
        const r = await registrarEntradaNotaCompra({
          pedido_id: pedido.id,
          itens: itensChegando.map((it) => {
            const v = valoresDe(produtoDoItem.get(it.pedido_item_id) ?? '')
            return { ...it, valor_unitario: v.vu, valor_ipi: v.ipi, valor_st: v.st }
          }),
          chave_acesso: chaveDigitos || null,
          data_entrega: dataEntrega || null,
          data_entrada: dataEntrada || null,
          valor_desconto: lerValor(desconto) || null,
          valor_despesas_acessorias: lerValor(despesasAcessorias) || null,
          vinculos: Object.entries(vinculos).flatMap(([produto_id, porL]) =>
            Object.entries(porL)
              .map(([projeto_item_id, q]) => ({ produto_id, projeto_item_id, quantidade: lerQtd(q) }))
              .filter((x) => x.quantidade > 0),
          ),
          numero_nf: numeroNf,
          data_emissao: dataEmissao || null,
          valor: valorNota,
          valor_st: stNota || null,
          observacao: observacao || null,
          arquivo,
          parcelas: parcelas.map((p) => ({
            data_vencimento: p.data_vencimento,
            valor: lerValor(p.valor),
          })),
          antecipacoes: Object.entries(usar)
            .map(([pagamento_id, v]) => ({ pagamento_id, valor: lerValor(v) }))
            .filter((a) => a.valor > 0),
          fornecedor_id: fornecedorNota?.id ?? null,
        })
        toast({
          title: 'Entrada de nota fiscal registrada',
          description: [
            r.status === 'recebido'
              ? 'Todos os itens chegaram: pedido Concluído.'
              : 'Ainda falta chegar item: pedido Concluído parcialmente.',
            r.parcelas > 0
              ? `${r.parcelas} parcela(s) no Contas a Pagar.`
              : 'Nota paga com pagamento antecipado (sem parcela).',
            r.fornecedor_trocado ? `O pedido passou para ${fornecedorNota?.nome}.` : '',
            Number(r.reservado) > 0
              ? `${fmtQtd(Number(r.reservado))} peça(s) foram para a reserva dos clientes.`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        })
        limparFormulario()
        carregarHistorico()
        // SPEC-220: já mostra o espelho da entrada (para o Mateus)
        if (r.nota_id) setEspelhoNotaId(r.nota_id)
        return
      }

      // Entrada avulsa (sem pedido): só a nota, como antes.
      await criarNotaFiscalCompra({
        pedido_compra_id: null,
        fornecedor_id: fornecedorSelecionado!.id,
        empresa_id: empresaId || null,
        produto_id: produtoSelecionado?.id || null,
        numero_nf: numeroNf,
        data_emissao: dataEmissao || null,
        valor: valor ? parseFloat(valor) : null,
        observacao: observacao || null,
        arquivo,
      })
      toast({ title: 'Entrada de nota fiscal registrada' })
      limparFormulario()
      carregarHistorico()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar entrada',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col space-y-4 w-full pb-20 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Entrada de Nota Fiscal
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Busque o pedido de compra pelo número e registre a nota fiscal recebida do fornecedor —
          pode anexar o PDF ou uma foto da nota.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wide text-slate-600">
            1. Localizar pedido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              size="sm"
              variant={modo === 'pedido' ? 'default' : 'outline'}
              onClick={() => trocarModo('pedido')}
            >
              Tenho o número do pedido
            </Button>
            <Button
              type="button"
              size="sm"
              variant={modo === 'avulsa' ? 'default' : 'outline'}
              onClick={() => trocarModo('avulsa')}
            >
              Não tenho pedido (entrada avulsa)
            </Button>
          </div>

          {modo === 'pedido' ? (
            <>
              <form onSubmit={buscarPedido} className="flex gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Número do pedido..."
                    className="pl-9"
                    value={numeroPedido}
                    onChange={(e) => setNumeroPedido(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={buscando || !numeroPedido.trim()}>
                  {buscando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Buscar
                </Button>
              </form>

              {naoEncontrado && (
                <p className="text-sm text-red-600 mt-3">
                  Nenhum pedido encontrado com esse número. Confira e tente novamente, ou use "Não
                  tenho pedido" acima se essa compra nunca teve pedido no sistema.
                </p>
              )}

              {pedido && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div>
                    <p className="text-slate-500">Pedido</p>
                    <p className="font-semibold">{pedido.numero}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-500">Fornecedor</p>
                    <p className={cn('font-semibold', fornecedorNota && 'line-through text-slate-400')}>
                      {pedido.fornecedor_nome}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {pedido.fornecedor_documento
                        ? `CNPJ ${formatarDocumento(pedido.fornecedor_documento)}`
                        : 'Sem CNPJ no cadastro'}
                    </p>
                    {fornecedorNota && (
                      <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1">
                        <p className="text-xs text-amber-800">Nota em nome de</p>
                        <p className="font-semibold">{fornecedorNota.nome}</p>
                        <p className="text-xs text-slate-600 tabular-nums">
                          {fornecedorNota.documento
                            ? `CNPJ ${formatarDocumento(fornecedorNota.documento)}`
                            : 'Sem CNPJ no cadastro'}
                        </p>
                        <p className="text-[11px] text-amber-800">
                          Ao registrar, o pedido passa a ser deste fornecedor.
                        </p>
                      </div>
                    )}
                    {!pedidoFechado && !trocandoFornecedor && (
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          if (fornecedorNota) setFornecedorNota(null)
                          else setTrocandoFornecedor(true)
                        }}
                      >
                        <ArrowRightLeft className="w-3 h-3 mr-1" />
                        {fornecedorNota
                          ? 'Voltar ao fornecedor do pedido'
                          : 'Trocar fornecedor (nota veio em outro nome)'}
                      </Button>
                    )}
                    {trocandoFornecedor && (
                      <div className="relative mt-1 max-w-sm">
                        <Input
                          autoFocus
                          className="h-8 text-sm"
                          placeholder="Buscar fornecedor da nota..."
                          value={buscaFornNota}
                          onChange={(e) => setBuscaFornNota(e.target.value)}
                          onBlur={() => setTimeout(() => setTrocandoFornecedor(false), 200)}
                        />
                        {buscaFornNota.trim() && resultadosFornNota.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-52">
                            {resultadosFornNota
                              .filter((f) => f.id !== pedido.fornecedor_id)
                              .map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                                  onMouseDown={async (e) => {
                                    e.preventDefault()
                                    const documento = await getDocumentoFornecedor(f.id).catch(() => null)
                                    setFornecedorNota({ id: f.id, nome: f.nome, documento })
                                    setTrocandoFornecedor(false)
                                    setBuscaFornNota('')
                                  }}
                                >
                                  {f.nome}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500">Empresa</p>
                    <p className="font-semibold">{pedido.empresa_nome ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Valor do pedido</p>
                    <p className="font-semibold">{fmtBRL(pedido.valor_total)}</p>
                    {pedido.condicoes_pagamento && (
                      <p className="text-xs text-slate-500">Condição: {pedido.condicoes_pagamento}</p>
                    )}
                  </div>
                  <div className="sm:col-span-4 flex items-center gap-2">
                    <span className="text-slate-500">Situação:</span>
                    <StatusBadge status={pedido.status} />
                    {pedidoFechado && (
                      <span className="text-xs text-red-600">
                        Este pedido não recebe mais entrada.
                      </span>
                    )}
                  </div>
                  {pedido.itens.length > 0 && (
                    <div className="sm:col-span-4">
                      <p className="text-slate-500 mb-1">
                        Itens — informe quanto chegou agora (pedido fica Concluído quando tudo chegar)
                      </p>
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-xs bg-white rounded border border-slate-200">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-200">
                            <th className="text-left font-medium p-2">Produto</th>
                            <th className="text-right font-medium p-2 w-20">Pedido</th>
                            <th className="text-right font-medium p-2 w-24">Já chegou</th>
                            <th className="text-right font-medium p-2 w-20">Falta</th>
                            <th className="text-right font-medium p-2 w-28">Chegou agora</th>
                            <th className="text-right font-medium p-2 w-24" title="Valor unitário na nota, sem IPI e ST">
                              Vl. unit.
                            </th>
                            <th className="text-right font-medium p-2 w-20">IPI/un.</th>
                            <th className="text-right font-medium p-2 w-20">ST/un.</th>
                            <th className="text-right font-medium p-2 w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pecas.map((g) => {
                            const aMais = lerChegou(g.produto_id) > g.falta
                            const chegaAgora = Math.min(lerChegou(g.produto_id), g.falta)
                            const vp = valoresPeca[g.produto_id] ?? { vu: '', ipi: '', st: '' }
                            const v = valoresDe(g.produto_id)
                            const mudarValor = (campo: keyof ValoresPeca, x: string) =>
                              setValoresPeca((prev) => ({ ...prev, [g.produto_id]: { ...vp, [campo]: x } }))
                            const esperando = entregas.filter((e) => e.produto_id === g.produto_id)
                            const meus = vinculos[g.produto_id] ?? {}
                            const vinculado = vinculadoDe(g.produto_id)
                            const vincAMais = vinculado > chegaAgora + 0.0001
                            return (
                              <Fragment key={g.produto_id}>
                              <tr className="border-b-0">
                                <td className="p-2 text-slate-700">
                                  {g.produto_codigo && (
                                    <span className="font-mono text-slate-400 mr-1.5">
                                      {g.produto_codigo}
                                    </span>
                                  )}
                                  {g.produto_nome}
                                  {g.itens.length > 1 && (
                                    <span className="block text-[11px] text-slate-400">
                                      soma de {g.itens.length} linhas (L) do pedido
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-right tabular-nums">{fmtQtd(g.quantidade)}</td>
                                <td className="p-2 text-right tabular-nums">{fmtQtd(g.qtd_recebida)}</td>
                                <td className="p-2 text-right tabular-nums font-semibold">{fmtQtd(g.falta)}</td>
                                <td className="p-2 text-right">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    className={cn(
                                      'h-8 w-24 ml-auto text-right text-sm',
                                      aMais && 'border-red-500 text-red-600',
                                    )}
                                    value={chegou[g.produto_id] ?? ''}
                                    disabled={pedidoFechado || g.falta <= 0}
                                    onChange={(e) =>
                                      setChegou((prev) => ({ ...prev, [g.produto_id]: e.target.value }))
                                    }
                                  />
                                  {aMais && (
                                    <span className="block text-[11px] text-red-600 mt-0.5">
                                      Maior que o que falta ({fmtQtd(g.falta)})
                                    </span>
                                  )}
                                </td>
                                {(['vu', 'ipi', 'st'] as const).map((campo) => (
                                  <td key={campo} className="p-2 text-right">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      className="h-8 w-20 ml-auto text-right text-sm"
                                      value={vp[campo]}
                                      disabled={pedidoFechado || g.falta <= 0}
                                      onChange={(e) => mudarValor(campo, e.target.value)}
                                    />
                                  </td>
                                ))}
                                <td className="p-2 text-right tabular-nums font-medium">
                                  {fmtBRL(r2(chegaAgora * (v.vu + v.ipi + v.st)))}
                                </td>
                              </tr>
                              {chegaAgora > 0 && (
                                <tr className="border-b border-slate-100 last:border-0">
                                  <td colSpan={9} className="px-2 pb-2 pt-0">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-slate-50 px-2 py-1 text-[11px]">
                                      <span className="text-slate-500">Para quem:</span>
                                      {Object.entries(meus).length === 0 ? (
                                        <span className="text-slate-500">
                                          {esperando.length === 0
                                            ? 'nenhuma venda espera esta peça — entra livre no estoque'
                                            : 'nenhum cliente vinculado — entra livre no estoque'}
                                        </span>
                                      ) : (
                                        Object.entries(meus).map(([pi, q]) => {
                                          const e = esperando.find((x) => x.projeto_item_id === pi)
                                          return (
                                            <span key={pi} className="rounded bg-white border border-slate-200 px-1.5 py-0.5">
                                              {e?.venda_numero ?? e?.orcamento_numero ?? '—'} ·{' '}
                                              {e?.cliente_nome ?? '—'} · <span className="font-mono">{e?.l_fixo ?? '—'}</span>:{' '}
                                              <strong>{fmtQtd(lerQtd(q))}</strong>
                                            </span>
                                          )
                                        })
                                      )}
                                      <span className={cn(vincAMais ? 'text-red-600 font-medium' : 'text-slate-500')}>
                                        vinculado {fmtQtd(vinculado)} de {fmtQtd(chegaAgora)}
                                        {!vincAMais && chegaAgora - vinculado > 0.0001
                                          ? ` · ${fmtQtd(chegaAgora - vinculado)} livre(s)`
                                          : ''}
                                      </span>
                                      {esperando.length > 0 && !pedidoFechado && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2 text-[11px]"
                                          onClick={() => setPecaVinculo(g.produto_id)}
                                        >
                                          <Users className="w-3 h-3 mr-1" /> Escolher clientes ({esperando.length})
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label>Fornecedor *</Label>
                {fornecedorSelecionado ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium">{fornecedorSelecionado.nome}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFornecedorSelecionado(null)
                        setFornecedorBusca('')
                      }}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Buscar fornecedor..."
                      value={fornecedorBusca}
                      onChange={(e) => setFornecedorBusca(e.target.value)}
                    />
                    {fornecedorBusca.trim() && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-52">
                        {buscandoFornecedor ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                          </div>
                        ) : fornecedorResultados.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">
                            Nenhum fornecedor encontrado.
                          </p>
                        ) : (
                          fornecedorResultados.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setFornecedorSelecionado(f)
                                setFornecedorBusca('')
                              }}
                            >
                              {f.nome}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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

              <div className="space-y-2 relative sm:col-span-2">
                <Label>Produto (opcional — pode linkar depois)</Label>
                {produtoSelecionado ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium">
                      {produtoSelecionado.nome}{' '}
                      {produtoSelecionado.codigo_produto != null && (
                        <span className="font-mono text-slate-400">
                          ({produtoSelecionado.codigo_produto})
                        </span>
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setProdutoSelecionado(null)
                        setProdutoBusca('')
                      }}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Buscar produto (opcional)..."
                      value={produtoBusca}
                      onChange={(e) => setProdutoBusca(e.target.value)}
                    />
                    {produtoBusca.trim() && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-auto max-h-52">
                        {buscandoProduto ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                          </div>
                        ) : produtoResultados.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">
                            Nenhum produto encontrado.
                          </p>
                        ) : (
                          produtoResultados.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setProdutoSelecionado(p)
                                setProdutoBusca('')
                              }}
                            >
                              {p.nome}{' '}
                              {p.codigo_produto != null && (
                                <span className="font-mono text-slate-400">
                                  ({p.codigo_produto})
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {podeRegistrar && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wide text-slate-600 flex items-center gap-2">
              <FileText className="w-4 h-4" /> 2. Registrar nota fiscal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da NF *</Label>
                <Input required value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data de emissão</Label>
                <Input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{modo === 'pedido' ? 'Valor total da nota *' : 'Valor'}</Label>
                <Input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => {
                    setValor(e.target.value)
                    setValorEditado(true)
                  }}
                />
              </div>
              {modo === 'pedido' && (
                <>
                  {/* SPEC-220: dados da nota (chave, datas) e o que entra no total além dos itens */}
                  <div className="space-y-2">
                    <Label>Chave de acesso (44 números, opcional)</Label>
                    <Input
                      inputMode="numeric"
                      value={chaveAcesso}
                      className={cn(!chaveOk && 'border-red-500')}
                      onChange={(e) => setChaveAcesso(e.target.value)}
                    />
                    {!chaveOk && (
                      <p className="text-[11px] text-red-600">
                        A chave tem 44 números (digitados {chaveDigitos.length}).
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Data de entrega</Label>
                      <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de entrada</Label>
                      <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Desconto da nota (R$)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label title="Frete e outras despesas que vêm na nota">Despesas acessórias (R$)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={despesasAcessorias}
                        onChange={(e) => setDespesasAcessorias(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3 text-xs">
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                      {[
                        ['Produtos', r2(totaisItens.produtos)],
                        ['IPI', r2(totaisItens.ipi)],
                        ['ST', r2(totaisItens.st)],
                        ['Desconto', -lerValor(desconto)],
                        ['Desp. acessórias', lerValor(despesasAcessorias)],
                        ['Total pelos itens', totalCalculado],
                      ].map(([rot, val]) => (
                        <div key={rot as string}>
                          <p className="text-slate-500">{rot}</p>
                          <p className="font-semibold tabular-nums">{fmtBRL(val as number)}</p>
                        </div>
                      ))}
                      <div>
                        <p className="text-slate-500">Diferença p/ a nota</p>
                        <p className={cn('font-semibold tabular-nums', totalBate ? 'text-emerald-700' : 'text-red-600')}>
                          {totalBate ? 'OK' : fmtBRL(r2(valorNota - totalCalculado))}
                        </p>
                      </div>
                    </div>
                    {!totalBate && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-red-700">
                        O total dos itens não bate com o valor da nota: ajuste o valor unitário dos itens, o desconto ou
                        as despesas acessórias.
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => {
                            setValor(totalCalculado.toFixed(2))
                            setValorEditado(false)
                          }}
                        >
                          Usar o total pelos itens
                        </Button>
                      </div>
                    )}
                    <p className="mt-2 text-slate-500">
                      Apropriação: <strong>COMPRAS - REVENDA</strong> · entra no setor <strong>Estoque Geral</strong> ·
                      "outras despesas" do pedido (ICMS recolhido depois) não entram na nota.
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Anexo (PDF ou foto)
                </Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  rows={2}
                  className="resize-none"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              {modo === 'pedido' && (
                <FinanceiroNotaEntrada
                  valorNota={valorNota}
                  valorSt={stNota}
                  parcelas={parcelas}
                  onParcelasChange={(p) => {
                    setParcelas(p)
                    setParcelasEditadas(true)
                  }}
                  onRefazer={() => {
                    setParcelasEditadas(false)
                    refazerParcelas()
                  }}
                  antecipacoes={antecipacoes}
                  usar={usar}
                  onUsarChange={(u) => {
                    setUsar(u)
                    setParcelasEditadas(false)
                  }}
                  disabled={salvando}
                />
              )}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={limparFormulario}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando || !numeroNf.trim() || (modo === 'pedido' && !entradaOk)}
                >
                  {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Registrar Entrada
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wide text-slate-600">
            Últimas entradas
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={carregarHistorico}
            disabled={loadingHistorico}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingHistorico ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs">Nº NF</TableHead>
                <TableHead className="text-xs">Pedido</TableHead>
                <TableHead className="text-xs">Fornecedor</TableHead>
                <TableHead className="text-xs">Empresa</TableHead>
                <TableHead className="text-xs">Emissão</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Anexo</TableHead>
                <TableHead className="text-xs text-center w-[200px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistorico ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-sm text-slate-400">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : historico.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-sm text-slate-400">
                    Nenhuma entrada registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                historico.map((nf) => (
                  <TableRow key={nf.id} className={cn(nf.cancelada_em && 'text-slate-400 bg-slate-50/60')}>
                    <TableCell className={cn('text-sm font-medium', nf.cancelada_em && 'line-through')}>
                      {nf.numero_nf}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-xs">
                      {nf.avulsa ? (
                        <span className="italic text-slate-400 font-sans">Avulsa (sem pedido)</span>
                      ) : (
                        nf.pedido_numero
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{nf.fornecedor_nome}</TableCell>
                    <TableCell className="text-sm">{nf.empresa_nome ?? '—'}</TableCell>
                    <TableCell className="text-sm">{fmtDate(nf.data_emissao)}</TableCell>
                    <TableCell className={cn('text-sm text-right font-mono', nf.cancelada_em && 'line-through')}>
                      {fmtBRL(nf.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      {nf.arquivo_url ? (
                        <a
                          href={nf.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          <ExternalLink className="w-3 h-3" /> Ver
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {!nf.avulsa && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          title="Espelho da entrada: o que chegou e para quem foi (PDF para o Mateus)"
                          onClick={() => setEspelhoNotaId(nf.id)}
                        >
                          <ScrollText className="w-3.5 h-3.5 mr-1" /> Espelho
                        </Button>
                      )}
                      {nf.cancelada_em ? (
                        <span
                          className="inline-block rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600"
                          title={`Cancelada em ${fmtDate(nf.cancelada_em)}${nf.motivo_cancelamento ? ` — ${nf.motivo_cancelamento}` : ''}`}
                        >
                          Cancelada
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setMotivoCancelamento('')
                            setNotaParaCancelar(nf)
                          }}
                        >
                          <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={notaParaCancelar != null}
        onOpenChange={(open) => {
          if (!open && !cancelando) setNotaParaCancelar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar entrada da NF {notaParaCancelar?.numero_nf}</AlertDialogTitle>
            <AlertDialogDescription>
              {notaParaCancelar?.avulsa
                ? 'As parcelas da nota saem do Contas a Pagar.'
                : `Desfaz tudo que esta entrada fez: a quantidade recebida volta no pedido ${notaParaCancelar?.pedido_numero} (e o status dele), o que foi para a reserva dos clientes volta para a entrega futura, as parcelas da nota saem do Contas a Pagar e o pagamento antecipado usado volta a ter saldo.`}{' '}
              A nota continua na lista, marcada como cancelada. Se o fornecedor do pedido foi trocado nesta
              entrada, ele não volta sozinho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo do cancelamento (obrigatório)"
            value={motivoCancelamento}
            onChange={(e) => setMotivoCancelamento(e.target.value)}
            disabled={cancelando}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmCancel()
              }}
              disabled={cancelando || !motivoCancelamento.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Cancelar entrada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SPEC-220: para quem vai o que chegou (entrega futura -> reserva) e espelho da entrada */}
      {pecaVinculo && (
        <VinculoClientesDialog
          aberto={!!pecaVinculo}
          onFechar={() => setPecaVinculo(null)}
          produtoNome={pecas.find((g) => g.produto_id === pecaVinculo)?.produto_nome ?? ''}
          chegou={(() => {
            const g = pecas.find((x) => x.produto_id === pecaVinculo)
            return g ? Math.min(lerChegou(g.produto_id), g.falta) : 0
          })()}
          entregas={entregas.filter((e) => e.produto_id === pecaVinculo)}
          valores={vinculos[pecaVinculo] ?? {}}
          onSalvar={(v) => {
            setVinculos((prev) => ({ ...prev, [pecaVinculo]: v }))
            setVinculosEditados((prev) => ({ ...prev, [pecaVinculo]: true }))
          }}
        />
      )}
      <EspelhoEntradaDialog notaId={espelhoNotaId} onFechar={() => setEspelhoNotaId(null)} />
    </div>
  )
}
