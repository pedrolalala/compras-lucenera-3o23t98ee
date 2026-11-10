// SPEC-271: rascunho do pedido de compra em montagem (Necessidade de Compra).
// A Débora alterava quantidades (ex.: 2 -> 20), saía para conferir algo e, ao voltar, tudo
// voltava ao valor original: o carrinho era estado da página e o modal refazia as linhas do zero.
// Guarda no navegador (localStorage, 24 h) o carrinho e as edições feitas no modal.
// Tudo em try/catch: sem storage (janela privada) a tela funciona como antes.

const PREFIXO = 'compras:rascunho-pedido:'
const VALIDADE_MS = 24 * 60 * 60 * 1000

interface Envelope<T> {
  t: number
  v: T
}

export function lerRascunho<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave)
    if (!bruto) return null
    const env = JSON.parse(bruto) as Envelope<T>
    if (!env || typeof env.t !== 'number' || Date.now() - env.t > VALIDADE_MS) {
      localStorage.removeItem(PREFIXO + chave)
      return null
    }
    return env.v
  } catch {
    return null
  }
}

export function gravarRascunho<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ t: Date.now(), v: valor } satisfies Envelope<T>))
  } catch {
    // sem storage — segue sem rascunho
  }
}

export function apagarRascunho(chave: string): void {
  try {
    localStorage.removeItem(PREFIXO + chave)
  } catch {
    // ignora
  }
}

/** Apaga o carrinho e todas as edições do modal (pedido gerado ou "Limpar"). */
export function apagarTodosRascunhosPedido(): void {
  try {
    const apagar: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIXO)) apagar.push(k)
    }
    apagar.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignora
  }
}

export const CHAVE_CARRINHO = 'carrinho'
export const chaveModal = (fornecedorId: string) => `modal:${fornecedorId}`
