import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// SPEC-209 B: custo da peça na compra igual ao do cadastro (SPEC-190).
//   preço de custo (já com o desconto do produto) + ST + IPI + outras despesas,
//   com ST/IPI/outras calculados em % sobre o preço de custo. ICMS não entra.

export interface PercentuaisCompra {
  stPerc: string
  ipiPerc: string
  outrasPerc: string
}

/** Lê número digitado com vírgula ou ponto ("3,75", "3.75", "1.234,56"). */
export function lerNumero(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v ?? '').trim()
  if (!s) return 0
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = parseFloat(normal)
  return Number.isFinite(n) ? n : 0
}

/** Percentual do cadastro para o campo de texto ("3,75"); vazio quando não há. */
export function percentualParaCampo(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return ''
  return String(v).replace('.', ',')
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

export function calcularCustoItem(precoCusto: number, p: PercentuaisCompra) {
  const st = round4((precoCusto * lerNumero(p.stPerc)) / 100)
  const ipi = round4((precoCusto * lerNumero(p.ipiPerc)) / 100)
  const outras = round4((precoCusto * lerNumero(p.outrasPerc)) / 100)
  return { st, ipi, outras, total: precoCusto + st + ipi + outras }
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const NO_SPINNER =
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

/** Campo de % com o valor em R$ calculado logo abaixo. */
export function CampoPercentual({
  value,
  onChange,
  valorReais,
  className,
}: {
  value: string
  onChange: (v: string) => void
  valorReais: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-end gap-0.5', className)}>
      <div className="relative w-full">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="0"
          className={cn('h-9 text-sm text-right pr-6', NO_SPINNER)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
      </div>
      <span className="text-[11px] text-slate-500 tabular-nums">{brl(valorReais)}</span>
    </div>
  )
}

/** Rodapé com os totais (reunião de 19/10). SPEC-222 F6/F7: IPI, ST e outras despesas separados e o campo de
 *  desconto do pedido aqui mesmo (`desconto`), onde se fecha o valor. */
export function TotaisCompra({
  totalProdutos,
  totalComImpostos,
  descontoPedidoPerc = 0,
  impostos,
  desconto,
}: {
  totalProdutos: number
  totalComImpostos: number
  descontoPedidoPerc?: number
  impostos?: { st: number; ipi: number; outras: number }
  desconto?: React.ReactNode
}) {
  if (totalProdutos <= 0 && totalComImpostos <= 0) return null
  return (
    <div className="ml-auto w-full sm:w-[420px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
      <div className="flex justify-between gap-4">
        <span className="text-slate-600">Valor total dos produtos</span>
        <span className="font-semibold text-slate-800 tabular-nums">{brl(totalProdutos)}</span>
      </div>
      {impostos &&
        (
          [
            ['ST', impostos.st],
            ['IPI', impostos.ipi],
            ['Outras despesas', impostos.outras],
          ] as [string, number][]
        ).map(([rotulo, v]) => (
          <div key={rotulo} className="flex justify-between gap-4 text-slate-600">
            <span>+ {rotulo}</span>
            <span className="tabular-nums">{brl(v)}</span>
          </div>
        ))}
      <div className="flex justify-between gap-4">
        <span className="text-slate-600">Valor total dos produtos com impostos</span>
        <span className="font-semibold text-slate-900 tabular-nums">{brl(totalComImpostos)}</span>
      </div>
      {desconto && <div className="flex items-center justify-between gap-4">{desconto}</div>}
      {descontoPedidoPerc > 0 && (
        <div className="flex justify-between gap-4 text-emerald-700">
          <span>Com desconto do pedido de {descontoPedidoPerc}%</span>
          <span className="font-semibold tabular-nums">
            {brl(totalComImpostos * (1 - descontoPedidoPerc / 100))}
          </span>
        </div>
      )}
    </div>
  )
}
