// Executar somente no terminal: node scripts/criar-usuario.mjs
// Configuração privada em .env.admin.local (ignorado pelo Git):
// SUPABASE_SECRET_KEY=chave_administrativa_do_projeto
// Opcional: SUPABASE_NEW_USER_PASSWORD=outra_senha
// Obrigatório: SUPABASE_NEW_USER_UNIT=Washington Luiz (ou Dr. Gurgel)
// Opcionais: SUPABASE_NEW_USER_EMAIL e SUPABASE_NEW_USER_NAME
// A URL do projeto é lida de .env.local. Nunca usar VITE_ para a chave administrativa.
import { criarClienteAdmin } from './admin-client.mjs';

async function main() {
  const supabase = criarClienteAdmin();
  const email = (process.env.SUPABASE_NEW_USER_EMAIL ?? 'jennifer@hotmail.com').trim();
  const nome = (process.env.SUPABASE_NEW_USER_NAME ?? 'Jennifer').trim();
  const unidade = process.env.SUPABASE_NEW_USER_UNIT;
  if (!nome || nome.length > 80 || !['Dr. Gurgel', 'Washington Luiz'].includes(unidade)) {
    throw new Error('Informe nome válido e SUPABASE_NEW_USER_UNIT (Dr. Gurgel ou Washington Luiz) em .env.admin.local.');
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: process.env.SUPABASE_NEW_USER_PASSWORD ?? '123',
    email_confirm: true,
    user_metadata: { nome, unidade }
  });
  if (error) {
    if (error.code === 'weak_password' || /password.*(least|short|weak|length)/i.test(error.message)) {
      throw new Error(`A senha foi recusada pela política do projeto: ${error.message}. Defina SUPABASE_NEW_USER_PASSWORD em .env.admin.local e execute novamente.`);
    }
    throw new Error(`Não foi possível criar a conta: ${error.message}`);
  }
  if (!data.user) throw new Error('O servidor não confirmou a criação da conta.');
  console.log(`Conta criada: ${data.user.email}. ID: ${data.user.id}`);
  console.log('Nome e unidade cadastrados. Entre no app somente com e-mail e senha.');
}

main().catch(erro => { console.error(erro.message); process.exitCode = 1; });
