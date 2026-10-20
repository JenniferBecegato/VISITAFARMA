import { createContext, useContext } from 'react';
import type { Identificacao } from './identificacao';
export interface Conta extends Identificacao { usuarioId: string; email: string }
export const ContextoConta = createContext<Conta | null>(null);
export function useConta() {
  const conta = useContext(ContextoConta);
  if (!conta) throw new Error('Entre na sua conta para continuar.');
  return conta;
}
const CHAVE = 'campos-conta-offline';
export function lerConta(): Conta | null {
  try {
    const valor = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    return valor && typeof valor.usuarioId === 'string' && typeof valor.nome === 'string' &&
      typeof valor.email === 'string' && ['Dr. Gurgel', 'Washington Luiz'].includes(valor.unidade) ? valor : null;
  } catch { return null; }
}
export function guardarConta(conta: Conta) { localStorage.setItem(CHAVE, JSON.stringify(conta)); }
export function limparConta() { localStorage.removeItem(CHAVE); }
