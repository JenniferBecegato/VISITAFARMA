import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurado = Boolean(url && chave);
export const CHAVE_AUTH = 'campos-supabase-auth';
export const supabase = configurado ? createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: CHAVE_AUTH },
  global: { fetch: (input, init) => fetch(input, { ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) }
}) : null;
export class SessaoInvalida extends Error {
  constructor() { super('Sua sessão expirou. Entre novamente para sincronizar.'); }
}
export async function validarSessao(usuarioId: string) {
  if (!supabase) throw new Error('Configure o Supabase em .env.local.');
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if ([400, 401, 403].includes(error.status ?? 0) || error.name === 'AuthSessionMissingError') throw new SessaoInvalida();
    throw new Error('Não foi possível alcançar o Supabase. Seus dados continuam salvos neste aparelho.');
  }
  if (data.user?.id !== usuarioId) throw new SessaoInvalida();
}
