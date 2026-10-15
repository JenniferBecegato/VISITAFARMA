export const UNIDADES = ['Dr. Gurgel', 'Washington Luiz'] as const;
export interface Identificacao { nome: string; unidade: typeof UNIDADES[number] }
const CHAVE = 'campos-visitas-identificacao';
export function lerIdentificacao(): Identificacao | null {
  try {
    const valor = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null');
    return valor && typeof valor.nome === 'string' && valor.nome.trim() && valor.nome.length <= 80 &&
      UNIDADES.includes(valor.unidade) ? { nome: valor.nome.trim(), unidade: valor.unidade } : null;
  } catch { return null; }
}
export function guardarIdentificacao(valor: Identificacao) {
  try { sessionStorage.setItem(CHAVE, JSON.stringify(valor)); } catch { /* A identificação permanece na sessão em memória. */ }
}
export function limparIdentificacao() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* O estado em memória também é limpo pelo aplicativo. */ }
}
