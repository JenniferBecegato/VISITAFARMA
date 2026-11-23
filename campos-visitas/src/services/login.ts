import type { SupabaseClient, User } from '@supabase/supabase-js';
import { UNIDADES } from './identificacao';
import type { Conta } from './conta';

export async function autenticarConta(cliente: SupabaseClient, email: string, senha: string): Promise<Conta> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const autenticar = async () => {
    const { data, error } = await cliente.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error?.code === 'email_not_confirmed') throw new Error('Confirme seu e-mail antes de entrar. Confira a caixa de entrada e o spam.');
    if (error?.code === 'invalid_credentials') throw new Error('E-mail ou senha incorretos.');
    if (error?.status === 429) throw new Error('Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');
    if (error || !data.user) throw new Error('Não foi possível entrar. Confira e-mail, senha e conexão.');
    return carregarConta(cliente, data.user);
  };
  try {
    return await Promise.race([autenticar(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('O servidor de login não respondeu. Confira se o celular tem acesso à internet e tente novamente.')), 20000);
    })]);
  } finally { clearTimeout(timer); }
}

export class PerfilIncompleto extends Error {
  constructor() { super('Seu cadastro está incompleto. Informe seu nome e unidade para continuar.'); }
}

export async function carregarConta(cliente: SupabaseClient, usuario: User): Promise<Conta> {
  const perfil = await cliente.from('usuarios').select('nome, unidade').eq('id', usuario.id).maybeSingle();
  if (perfil.error) throw new Error('Não foi possível carregar seu cadastro. Tente novamente.');
  const nome = perfil.data?.nome;
  const unidade = perfil.data?.unidade;
  if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 80 || !UNIDADES.includes(unidade)) {
    throw new PerfilIncompleto();
  }
  return { usuarioId: usuario.id, email: usuario.email ?? '', nome: nome.trim(), unidade };
}
