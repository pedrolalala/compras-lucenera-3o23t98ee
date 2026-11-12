import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertTriangle, Landmark, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AntecipacaoEntrada, PagamentoExistente } from '@/services/notas-fiscais-compra'

// SPEC-215: parte financeira da Entrada de Nota Fiscal. As parcelas vêm sugeridas pela condição do pedido,
// com o ST inteiro na 1ª, e são todas editáveis (quase nunca são divididas igualmente). O pagamento
// antecipado vinculado desconta do total; se cobrir a nota toda, não sobra parcela.

export interface ParcelaNota {
  data_vencimento: string
  valor: string
}

// SPEC-289 B: "este pedido já foi pago (antecipado / à vista)" marcado na entrada da nota.
export interface PagoNaEntrada {
  ativo: boolean
  valor: string
  data: string
  obs: string
  /** SPEC-290 D2: só quem tem acesso ao financeiro — lançar pagamento novo mesmo havendo um equivalente (observação obrigatória). */
  forcar: boolean
}

export const lerValor = (v: string) => {
  const t = (v ?? '').trim()
  if (!t) return 0
  // "1.234,56" (digitado) ou "1234.56" (sugerido)
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return parseFloat(n) || 0
}

const r2 = (n: number) => Math.round(n * 100) / 100

export const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Divide o restante nas datas, com o ST inteiro na 1ª parcela; a última parcela leva o arredondamento. */
export function dividirParcelas(restante: number, st: number, datas: string[]): ParcelaNota[] {
  restante = r2(restante)
  if (restante <= 0 || datas.length === 0) return []
  const stNaPrimeira = datas.length > 1 ? Math.min(Math.max(st, 0), restante) : 0
  const base = restante - stNaPrimeira
  const cada = Math.floor((base / datas.length) * 100) / 100
  const valores = datas.map(() => cada)
  valores[0] = r2(valores[0] + stNaPrimeira)
  const ultima = datas.length - 1
  valores[ultima] = r2(restante - valores.slice(0, ultima).reduce((s, v) => s + v, 0))
  // Sinal que cobriu quase tudo pode deixar parcela zerada: ela sai.
  return datas
    .map((d, i) => ({ data_vencimento: d, valor: valores[i].toFixed(2) }))
    .filter((p) => Number(p.valor) > 0)
}

export function FinanceiroNotaEntrada({
  valorNota,
  valorSt,
  parcelas,
  onParcelasChange,
  onRefazer,
  antecipacoes,
  pedidoNumero,
  totalPedido,
  pago,
  onPagoChange,
  pagoAplicado,
  usar,
  onUsarChange,
  existentes,
  vincular,
  onVincularChange,
  condicaoAntecipada,
  bloqueioPago,
  erroDeteccao,
  disabled,
}: {
  valorNota: number
  valorSt: number
  parcelas: ParcelaNota[]
  onParcelasChange: (p: ParcelaNota[]) => void
  onRefazer: () => void
  antecipacoes: AntecipacaoEntrada[]
  pedidoNumero: string | null
  totalPedido: number
  pago: PagoNaEntrada
  onPagoChange: (p: PagoNaEntrada) => void
  /** Quanto do pagamento "já foi pago" cobre esta nota (o que passar disso fica de saldo no pedido). */
  pagoAplicado: number
  usar: Record<string, string>
  onUsarChange: (u: Record<string, string>) => void
  /** SPEC-290: pagamentos já existentes (Connect/adiantamento) do fornecedor, para vincular à nota sem abrir outro Contas a Pagar. */
  existentes: PagamentoExistente[]
  /** parcela_id -> valor a vincular (texto). */
  vincular: Record<string, string>
  onVincularChange: (v: Record<string, string>) => void
  /** O pedido tem a condição "Antecipado" (já pago): sem vínculo, avisa "Pago — falta vincular o pagamento". */
  condicaoAntecipada: boolean
  /** Há pagamento equivalente: a opção "já foi pago" fica bloqueada (só o financeiro força). */
  bloqueioPago: boolean
  /** A consulta dos pagamentos já feitos falhou: "já foi pago" fica bloqueado. */
  erroDeteccao: boolean
  disabled?: boolean
}) {
  const usadoMarcado = r2(Object.values(usar).reduce((s, v) => s + lerValor(v), 0))
  const vinculadoTotal = r2(Object.values(vincular).reduce((s, v) => s + lerValor(v), 0))
  const usado = r2(usadoMarcado + vinculadoTotal + pagoAplicado)
  const podeForcar = existentes.some((e) => e.pode_forcar)
  const obsFaltando = pago.ativo && bloqueioPago && podeForcar && pago.forcar && !pago.obs.trim()
  const somaParcelas = r2(parcelas.reduce((s, p) => s + lerValor(p.valor), 0))
  const diferenca = r2(valorNota - usado - somaParcelas)
  // Pedido que já tem antecipação ligada (lançada pela Lana): usa essa, sem pedir de novo
  const ligadas = antecipacoes.filter((a) => !!pedidoNumero && a.pedido_numero === pedidoNumero)
  const hojeStr = new Date().toISOString().slice(0, 10)
  const valorPago = lerValor(pago.valor)
  // SPEC-289: teto = valor total do pedido (o banco também recusa acima disso; tolerância de R$ 0,01)
  const acimaDoPedido = totalPedido > 0 && valorPago > totalPedido + 0.01
  const dataFutura = !!pago.data && pago.data > hojeStr

  function marcar(a: AntecipacaoEntrada, marcado: boolean) {
    const novo = { ...usar }
    if (marcado) {
      const outros = Object.entries(usar)
        .filter(([id]) => id !== a.id)
        .reduce((s, [, v]) => s + lerValor(v), 0)
      novo[a.id] = r2(Math.max(0, Math.min(a.saldo, valorNota - outros))).toFixed(2)
    } else {
      delete novo[a.id]
    }
    onUsarChange(novo)
  }

  function marcarExistente(e: PagamentoExistente, marcado: boolean) {
    const novo = { ...vincular }
    if (marcado) {
      const outros = Object.entries(vincular)
        .filter(([id]) => id !== e.parcela_id)
        .reduce((s, [, v]) => s + lerValor(v), 0)
      novo[e.parcela_id] = r2(Math.max(0, Math.min(e.saldo, valorNota - usadoMarcado - outros))).toFixed(2)
    } else {
      delete novo[e.parcela_id]
    }
    onVincularChange(novo)
  }

  function mudarParcela(i: number, campo: keyof ParcelaNota, v: string) {
    onParcelasChange(parcelas.map((p, j) => (j === i ? { ...p, [campo]: v } : p)))
  }

  return (
    <div className="sm:col-span-4 space-y-3 rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Financeiro da nota</p>

      {erroDeteccao && (
        <p className="text-xs rounded-md border border-red-300 bg-red-50 p-2 text-red-800 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Não consegui consultar pagamentos já feitos.</strong> Não registre como pago sem falar com o
            Financeiro (a opção "já foi pago" está bloqueada).
          </span>
        </p>
      )}

      {existentes.length > 0 && (
        <div className="rounded-md border border-sky-300 bg-sky-50 p-3 space-y-2">
          <p className="text-sm font-medium text-sky-900 flex items-center gap-1.5">
            <Landmark className="w-4 h-4" /> Pagamento já feito para este fornecedor
          </p>
          <p className="text-xs text-sky-800">
            Se esta nota é de um pedido que já foi pago, vincule o pagamento abaixo: ele cobre a nota{' '}
            <strong>sem abrir outro Contas a Pagar</strong>. Nada vem marcado: confira se é mesmo o pagamento desta compra e clique para vincular.
          </p>
          {existentes.map((e) => {
            const marcado = e.parcela_id in vincular
            const acima = lerValor(vincular[e.parcela_id] ?? '') > e.saldo + 0.001
            return (
              <div key={e.parcela_id} className="flex flex-wrap items-center gap-2 text-sm">
                <Checkbox
                  checked={marcado}
                  disabled={disabled}
                  onCheckedChange={(c) => marcarExistente(e, c === true)}
                />
                <span className="flex-1 min-w-[220px]">
                  Duplicata <strong>{e.duplicata || '—'}</strong> — {fmtBRL(e.valor)} — paga em{' '}
                  {new Date(e.data_pagamento + 'T12:00').toLocaleDateString('pt-BR')} —{' '}
                  {e.origem === 'legado_connect' ? 'Connect' : 'adiantamento'}
                  {e.valor_igual && <span className="text-xs font-medium text-sky-800"> · valor igual ao do pedido</span>}
                  {e.saldo < e.valor - 0.005 && <span className="text-xs text-slate-500"> · saldo {fmtBRL(e.saldo)}</span>}
                </span>
                {e.outros_pedidos && (
                  <span className="basis-full pl-6 text-xs text-amber-800">
                    Atenção: o pedido aberto {e.outros_pedidos} deste fornecedor tem valor parecido. Confira qual compra este pagamento quitou.
                  </span>
                )}
                {marcado && (
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Vincular</span>
                    <Input
                      inputMode="decimal"
                      className={cn('h-8 w-28 text-right', acima && 'border-red-500 text-red-600')}
                      value={vincular[e.parcela_id]}
                      disabled={disabled}
                      onChange={(ev) => onVincularChange({ ...vincular, [e.parcela_id]: ev.target.value })}
                    />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {condicaoAntecipada && vinculadoTotal <= 0 && ligadas.length === 0 && !pago.ativo && (
        <p className="text-xs rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Pago — falta vincular o pagamento.</strong> Este pedido está como "Antecipado".{' '}
            {existentes.length > 0
              ? 'Marque acima o pagamento já feito (não use "já foi pago", para não pagar em dobro).'
              : 'Não achei pagamento deste fornecedor: peça ao Financeiro para conferir antes de lançar a entrada.'}
          </span>
        </p>
      )}

      {antecipacoes.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
            <Wallet className="w-4 h-4" /> Existe pagamento antecipado para este fornecedor
          </p>
          <p className="text-xs text-amber-800">
            Marque para vincular a esta nota: o valor usado desconta do total e as parcelas ficam só
            com o restante.
          </p>
          {antecipacoes.map((a) => {
            const marcado = a.id in usar
            const acima = lerValor(usar[a.id] ?? '') > a.saldo + 0.001
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Checkbox
                  checked={marcado}
                  disabled={disabled}
                  onCheckedChange={(c) => marcar(a, c === true)}
                />
                <span className="flex-1 min-w-[220px]">
                  {a.fornecedor_nome} — pago em {new Date(a.data_pagamento + 'T12:00').toLocaleDateString('pt-BR')}
                  {a.pedido_numero ? ` (pedido ${a.pedido_numero})` : ''} · saldo{' '}
                  <strong>{fmtBRL(a.saldo)}</strong>
                  {a.observacao && <span className="block text-xs text-slate-500">{a.observacao}</span>}
                </span>
                {marcado && (
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Usar</span>
                    <Input
                      inputMode="decimal"
                      className={cn('h-8 w-28 text-right', acima && 'border-red-500 text-red-600')}
                      value={usar[a.id]}
                      disabled={disabled}
                      onChange={(e) => onUsarChange({ ...usar, [a.id]: e.target.value })}
                    />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {ligadas.length > 0 ? (
        <p className="text-xs rounded-md border border-sky-200 bg-sky-50 p-2 text-sky-900">
          Este pedido já tem pagamento antecipado lançado ({ligadas.map((a) => fmtBRL(a.saldo)).join(' + ')} de saldo):
          ele já vem marcado acima com o que cabe nesta nota (dá para editar o valor ou desmarcar), sem lançar de novo.
        </p>
      ) : vinculadoTotal > 0 ? (
        <p className="text-xs rounded-md border border-sky-200 bg-sky-50 p-2 text-sky-900">
          Esta nota usa um pagamento já existente: a opção "já foi pago" fica desligada (não se paga duas vezes).
        </p>
      ) : (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-emerald-900 cursor-pointer">
            <Checkbox
              checked={pago.ativo}
              disabled={disabled || erroDeteccao}
              onCheckedChange={(c) =>
                onPagoChange({
                  ...pago,
                  ativo: c === true,
                  valor: c === true && !pago.valor && totalPedido > 0 ? r2(totalPedido).toFixed(2) : pago.valor,
                })
              }
            />
            Este pedido já foi pago (antecipado / à vista)
          </label>
          {pago.ativo && bloqueioPago && (
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800 space-y-1.5">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Já existe pagamento deste fornecedor equivalente a este pedido</strong> (quadro azul acima). Vincule o
                  pagamento existente em vez de lançar outro, para não pagar em dobro.
                </span>
              </p>
              {podeForcar ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={pago.forcar}
                    disabled={disabled}
                    onCheckedChange={(c) => onPagoChange({ ...pago, forcar: c === true })}
                  />
                  Lançar pagamento novo mesmo assim (Financeiro) — a observação abaixo é obrigatória
                </label>
              ) : (
                <p>Só o Financeiro pode lançar um pagamento novo nesse caso.</p>
              )}
            </div>
          )}
          {pago.ativo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Valor pago (R$)</Label>
                <Input
                  inputMode="decimal"
                  className={cn('h-8 text-right', (valorPago <= 0 || acimaDoPedido) && 'border-red-400')}
                  value={pago.valor}
                  disabled={disabled}
                  onChange={(e) => {
                    // limita ao total do pedido
                    const v = lerValor(e.target.value)
                    onPagoChange({
                      ...pago,
                      valor:
                        totalPedido > 0 && v > totalPedido + 0.01 ? r2(totalPedido).toFixed(2) : e.target.value,
                    })
                  }}
                />
                {totalPedido > 0 && (
                  <p className={cn('text-[11px]', acimaDoPedido ? 'text-red-600' : 'text-slate-500')}>
                    {acimaDoPedido
                      ? `O valor pago não pode passar do total do pedido (${fmtBRL(totalPedido)}).`
                      : `Máximo: total do pedido (${fmtBRL(totalPedido)}).`}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data do pagamento</Label>
                <Input
                  type="date"
                  max={hojeStr}
                  className={cn('h-8', (!pago.data || dataFutura) && 'border-red-400')}
                  value={pago.data}
                  disabled={disabled}
                  onChange={(e) => onPagoChange({ ...pago, data: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Observação {bloqueioPago && podeForcar && pago.forcar ? '(obrigatória)' : '(opcional)'}
                </Label>
                <Input
                  className={cn('h-8', obsFaltando && 'border-red-400')}
                  value={pago.obs}
                  disabled={disabled}
                  onChange={(e) => onPagoChange({ ...pago, obs: e.target.value })}
                />
              </div>
              <p className="sm:col-span-3 text-xs text-emerald-800">
                Vale direto, sem aprovação: o pagamento fica registrado como antecipação deste pedido (a Lana vê em
                Antecipações) e já é descontado desta nota; as parcelas ficam só com o restante.
                {valorPago > valorNota && valorNota > 0
                  ? ` Pago a mais que esta nota: ${fmtBRL(valorPago - pagoAplicado)} ficam de saldo para as próximas notas do pedido.`
                  : ''}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">
            Parcelas a pagar{valorSt > 0 && parcelas.length > 1 ? ' (ST na 1ª parcela)' : ''}
          </Label>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onRefazer} disabled={disabled}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refazer pelas condições do pedido
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => onParcelasChange([...parcelas, { data_vencimento: '', valor: '' }])}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Parcela
            </Button>
          </div>
        </div>
        {parcelas.length === 0 ? (
          <p className="text-xs text-slate-500">
            {valorNota > 0 && usado >= valorNota
              ? 'Nota paga inteira com pagamento antecipado: não gera parcela.'
              : 'Nenhuma parcela.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="text-left font-medium pb-1 w-10">Nº</th>
                <th className="text-left font-medium pb-1">Vencimento</th>
                <th className="text-right font-medium pb-1">Valor (R$)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p, i) => (
                <tr key={i}>
                  <td className="py-1 text-slate-500">{i + 1}</td>
                  <td className="py-1">
                    <Input
                      type="date"
                      className={cn('h-8 w-40', !p.data_vencimento && 'border-red-400')}
                      value={p.data_vencimento}
                      disabled={disabled}
                      onChange={(e) => mudarParcela(i, 'data_vencimento', e.target.value)}
                    />
                  </td>
                  <td className="py-1">
                    <Input
                      inputMode="decimal"
                      className={cn('h-8 w-32 ml-auto text-right', lerValor(p.valor) <= 0 && 'border-red-400')}
                      value={p.valor}
                      disabled={disabled}
                      onChange={(e) => mudarParcela(i, 'valor', e.target.value)}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      disabled={disabled}
                      onClick={() => onParcelasChange(parcelas.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-t border-slate-100 pt-2">
        <div>
          <p className="text-slate-500">Valor da nota</p>
          <p className="font-semibold tabular-nums">{fmtBRL(valorNota)}</p>
        </div>
        <div>
          <p className="text-slate-500">Pagamento antecipado</p>
          <p className="font-semibold tabular-nums">{fmtBRL(usado)}</p>
        </div>
        <div>
          <p className="text-slate-500">Soma das parcelas</p>
          <p className="font-semibold tabular-nums">{fmtBRL(somaParcelas)}</p>
        </div>
        <div>
          <p className="text-slate-500">Diferença</p>
          <p className={cn('font-semibold tabular-nums', Math.abs(diferenca) > 0.01 ? 'text-red-600' : 'text-emerald-700')}>
            {Math.abs(diferenca) > 0.01 ? fmtBRL(diferenca) : 'OK'}
          </p>
        </div>
      </div>
    </div>
  )
}
