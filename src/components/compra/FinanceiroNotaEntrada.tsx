import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, RefreshCw, Trash2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AntecipacaoEntrada } from '@/services/notas-fiscais-compra'

// SPEC-215: parte financeira da Entrada de Nota Fiscal. As parcelas vêm sugeridas pela condição do pedido,
// com o ST inteiro na 1ª, e são todas editáveis (quase nunca são divididas igualmente). O pagamento
// antecipado vinculado desconta do total; se cobrir a nota toda, não sobra parcela.

export interface ParcelaNota {
  data_vencimento: string
  valor: string
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
  usar,
  onUsarChange,
  disabled,
}: {
  valorNota: number
  valorSt: number
  parcelas: ParcelaNota[]
  onParcelasChange: (p: ParcelaNota[]) => void
  onRefazer: () => void
  antecipacoes: AntecipacaoEntrada[]
  usar: Record<string, string>
  onUsarChange: (u: Record<string, string>) => void
  disabled?: boolean
}) {
  const usado = r2(Object.values(usar).reduce((s, v) => s + lerValor(v), 0))
  const somaParcelas = r2(parcelas.reduce((s, p) => s + lerValor(p.valor), 0))
  const diferenca = r2(valorNota - usado - somaParcelas)

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

  function mudarParcela(i: number, campo: keyof ParcelaNota, v: string) {
    onParcelasChange(parcelas.map((p, j) => (j === i ? { ...p, [campo]: v } : p)))
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Financeiro da nota</p>

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
