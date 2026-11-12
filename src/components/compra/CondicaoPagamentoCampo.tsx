import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// SPEC-222 F8/F9: condição de pagamento obrigatória no pedido. Três jeitos:
//   - prazo: "30/60/90" (dias da data do pedido) ou datas "15/11, 15/12" — gera as parcelas;
//   - À vista: uma parcela na data do pedido;
//   - Antecipado: já foi pago e lançado no Contas a Pagar — o pedido não gera parcela (evita saída em dobro).
// O texto gravado em pedidos_compra.condicoes_pagamento é o que o banco lê (_lucenera_datas_parcelas).
// SPEC-231 B1 (pedido da Débora): "Por datas" escolhe a data de cada parcela no calendário (é previsão:
// entrega em 15 dias + 30 da nota = ~45 dias). Grava "dd/mm/aaaa, dd/mm/aaaa", que o banco já entende.

export const CONDICAO_A_VISTA = 'À vista'
export const CONDICAO_ANTECIPADO = 'Antecipado'

type Tipo = 'prazo' | 'datas' | 'vista' | 'antecipado'

const DATA_COMPLETA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** "15/11/2026, 15/12/2026" -> ['2026-11-15', '2026-12-15']; null se não for só datas completas. */
function datasDaCondicao(v: string): string[] | null {
  const grupos = v.split(/[,;\s]+/).filter(Boolean)
  if (grupos.length === 0) return null
  const datas: string[] = []
  for (const g of grupos) {
    const m = DATA_COMPLETA.exec(g)
    if (!m) return null
    datas.push(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
  }
  return datas
}

const condicaoDasDatas = (datas: string[]) =>
  datas
    .filter(Boolean)
    .map((d) => d.split('-').reverse().join('/'))
    .join(', ')

export function tipoDaCondicao(v: string): Tipo {
  const t = v.trim().toLowerCase()
  if (t.includes('vista')) return 'vista'
  if (t.includes('antecipad')) return 'antecipado'
  if (datasDaCondicao(t)) return 'datas'
  return 'prazo'
}

// SPEC-286: parcelas com valores diferentes (ex.: sinal de 25% + 3 parcelas). Os percentuais ficam em
// pedidos_compra.condicoes_percentuais (na ordem das datas); o texto continua só com as datas.
const lerPct = (v: string) => {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const fmtPct = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
function partesIguais(n: number): number[] {
  const base = Math.floor(10000 / n) / 100
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? base : Math.round((100 - base * (n - 1)) * 100) / 100))
}
/** Percentuais prontos para salvar: todos > 0 e soma 100 (±0,01). */
export const percentuaisValidos = (p: number[] | null | undefined) =>
  !p || (p.length > 0 && p.every((x) => x > 0) && Math.abs(p.reduce((a, b) => a + b, 0) - 100) <= 0.01)
const brlCampo = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const condicaoAntecipada = (v: string | null | undefined) => tipoDaCondicao(v ?? '') === 'antecipado'

export function CondicaoPagamentoCampo({
  value,
  onChange,
  obrigatorio = true,
  className,
  total,
  percentuais,
  onPercentuaisChange,
}: {
  value: string
  onChange: (v: string) => void
  obrigatorio?: boolean
  className?: string
  /** total do pedido (só para mostrar o valor em R$ de cada parcela) */
  total?: number
  /** % de cada parcela (null = partes iguais); precisa de onPercentuaisChange para aparecer a opção */
  percentuais?: number[] | null
  onPercentuaisChange?: (p: number[] | null) => void
}) {
  const [pcts, setPcts] = useState<string[] | null>(() => (percentuais ? percentuais.map(fmtPct) : null))
  useEffect(() => {
    // pedido carregado depois da montagem (Editar Pedido)
    if (percentuais && (!pcts || pcts.map(lerPct).join('|') !== percentuais.join('|'))) setPcts(percentuais.map(fmtPct))
    if (!percentuais && pcts && pcts.length === 0) setPcts(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percentuais ? percentuais.join('|') : ''])
  function emitirPcts(novos: string[] | null) {
    setPcts(novos)
    onPercentuaisChange?.(novos ? novos.map(lerPct) : null)
  }
  // "Por datas" vazio ainda não tem texto que o identifique: o modo fica guardado aqui.
  const [modo, setModo] = useState<Tipo>(() => tipoDaCondicao(value))
  const [datas, setDatas] = useState<string[]>(() => datasDaCondicao(value.trim()) ?? [''])
  useEffect(() => {
    const t = tipoDaCondicao(value)
    if (t !== 'prazo' || modo !== 'datas') setModo(t)
    // valor que chegou de fora (ex.: Editar Pedido carregando o pedido)
    const vindas = datasDaCondicao(value.trim())
    if (vindas && condicaoDasDatas(datas) !== value.trim()) setDatas(vindas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const tipo = modo

  function mudarDatas(novas: string[]) {
    setDatas(novas)
    onChange(condicaoDasDatas(novas))
  }

  const opcoes: { tipo: Tipo; rotulo: string }[] = [
    { tipo: 'prazo', rotulo: 'A prazo (dias)' },
    { tipo: 'datas', rotulo: 'Por datas' },
    { tipo: 'vista', rotulo: 'À vista' },
    { tipo: 'antecipado', rotulo: 'Antecipado (já pago)' },
  ]
  const faltando = obrigatorio && !value.trim()
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm text-slate-600">
        Condição de pagamento {obrigatorio && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex flex-wrap gap-1">
        {opcoes.map((o) => (
          <button
            key={o.tipo}
            type="button"
            onClick={() => {
              setModo(o.tipo)
              if (pcts) emitirPcts(null)
              if (o.tipo === 'datas') {
                setDatas([''])
                onChange('')
              } else {
                onChange(o.tipo === 'vista' ? CONDICAO_A_VISTA : o.tipo === 'antecipado' ? CONDICAO_ANTECIPADO : '')
              }
            }}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              tipo === o.tipo
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {tipo === 'prazo' && (
        <Input
          placeholder="30/60/90 (dias a partir do pedido)"
          className={cn('h-11 text-sm', faltando && 'border-red-400')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {tipo === 'datas' && (
        <div className="space-y-1.5">
          {datas.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-500">{i + 1}ª parcela</span>
              <Input
                type="date"
                className={cn('h-9 w-44 text-sm', !d && 'border-red-400')}
                value={d}
                onChange={(e) => mudarDatas(datas.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {pcts && (
                <>
                  <Input
                    inputMode="decimal"
                    className="h-9 w-20 text-right text-sm"
                    title="Percentual desta parcela"
                    value={pcts[i] ?? ''}
                    onChange={(e) => emitirPcts(pcts.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <span className="text-xs text-slate-500">%</span>
                  {!!total && total > 0 && (
                    <span className="w-28 text-xs text-slate-600">{brlCampo((total * lerPct(pcts[i] ?? '')) / 100)}</span>
                  )}
                </>
              )}
              {datas.length > 1 && (
                <button
                  type="button"
                  title="Tirar parcela"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => {
                    mudarDatas(datas.filter((_, j) => j !== i))
                    if (pcts) emitirPcts(pcts.filter((_, j) => j !== i))
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setDatas([...datas, ''])
              if (pcts) emitirPcts([...pcts, ''])
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Parcela
          </button>
          {onPercentuaisChange && (
            <label className="flex items-center gap-2 pt-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={!!pcts}
                onChange={(e) => emitirPcts(e.target.checked ? partesIguais(datas.length).map(fmtPct) : null)}
              />
              Valores diferentes por parcela (ex.: sinal de 25% + o resto em parcelas)
            </label>
          )}
          {pcts && (
            <p
              className={cn(
                'text-xs',
                percentuaisValidos(pcts.map(lerPct)) ? 'text-emerald-700' : 'font-medium text-red-600',
              )}
            >
              Soma das parcelas: {fmtPct(pcts.map(lerPct).reduce((a, b) => a + b, 0))}%
              {percentuaisValidos(pcts.map(lerPct)) ? '' : ' — precisa fechar 100% e nenhuma parcela pode ficar zerada.'}
            </p>
          )}
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        {tipo === 'antecipado'
          ? 'Já pago e lançado no Contas a Pagar: o pedido não gera parcela. Na entrada da nota, vincule o pagamento antecipado.'
          : tipo === 'vista'
            ? 'Uma parcela na data do pedido.'
            : tipo === 'datas'
              ? pcts
                ? 'Cada parcela com o percentual informado (previsão de pagamento).'
                : 'Uma parcela em cada data, em partes iguais (previsão de pagamento).'
              : 'As parcelas são geradas em partes iguais (previsão de pagamento).'}
      </p>
    </div>
  )
}
