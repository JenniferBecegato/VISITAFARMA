import type { SupabaseClient } from '@supabase/supabase-js';
import { UNIDADES } from './identificacao';
import type { Conta } from './conta';

export async function autenticarConta(cliente: SupabaseClient, email: string, senha: string): Promise<Conta> {
  const { data, error } = await cliente.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error || !data.user) throw new Error('Não foi possível entrar. Confira e-mail, senha e conexão.');
  const perfil = await cliente.from('usuarios').select('nome, unidade').eq('id', data.user.id).maybeSingle();
  if (perfil.error) throw new Error('Não foi possível carregar seu cadastro. Tente novamente.');
  const nome = perfil.data?.nome;
  const unidade = perfil.data?.unidade;
  if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 80 || !UNIDADES.includes(unidade)) {
    throw new Error('Seu cadastro está incompleto. Solicite à administração o preenchimento do nome e da unidade.');
  }
  return { usuarioId: data.user.id, email: data.user.email ?? email.trim(), nome: nome.trim(), unidade };
}
