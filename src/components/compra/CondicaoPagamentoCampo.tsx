import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// SPEC-222 F8/F9: condição de pagamento obrigatória no pedido. Três jeitos:
//   - prazo: "30/60/90" (dias da data do pedido) ou datas "15/11, 15/12" — gera as parcelas;
//   - À vista: uma parcela na data do pedido;
//   - Antecipado: já foi pago e lançado no Contas a Pagar — o pedido não gera parcela (evita saída em dobro).
// O texto gravado em pedidos_compra.condicoes_pagamento é o que o banco lê (_lucenera_datas_parcelas).

export const CONDICAO_A_VISTA = 'À vista'
export const CONDICAO_ANTECIPADO = 'Antecipado'

type Tipo = 'prazo' | 'vista' | 'antecipado'

export function tipoDaCondicao(v: string): Tipo {
  const t = v.trim().toLowerCase()
  if (t.includes('vista')) return 'vista'
  if (t.includes('antecipad')) return 'antecipado'
  return 'prazo'
}

export const condicaoAntecipada = (v: string | null | undefined) => tipoDaCondicao(v ?? '') === 'antecipado'

export function CondicaoPagamentoCampo({
  value,
  onChange,
  obrigatorio = true,
  className,
}: {
  value: string
  onChange: (v: string) => void
  obrigatorio?: boolean
  className?: string
}) {
  const tipo = tipoDaCondicao(value)
  const opcoes: { tipo: Tipo; rotulo: string }[] = [
    { tipo: 'prazo', rotulo: 'A prazo' },
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
            onClick={() =>
              onChange(o.tipo === 'vista' ? CONDICAO_A_VISTA : o.tipo === 'antecipado' ? CONDICAO_ANTECIPADO : '')
            }
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
          placeholder="30/60/90 (dias) ou datas: 15/11, 15/12"
          className={cn('h-11 text-sm', faltando && 'border-red-400')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="text-[11px] text-slate-500">
        {tipo === 'antecipado'
          ? 'Já pago e lançado no Contas a Pagar: o pedido não gera parcela. Na entrada da nota, vincule o pagamento antecipado.'
          : tipo === 'vista'
            ? 'Uma parcela na data do pedido.'
            : 'As parcelas são geradas em partes iguais (previsão de pagamento).'}
      </p>
    </div>
  )
}
