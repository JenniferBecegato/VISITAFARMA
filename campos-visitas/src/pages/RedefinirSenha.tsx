import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import logoCampos from '../assets/logo-campos.png';

interface Props {
  cliente: SupabaseClient;
  usuarioId: string;
  terminar: (aviso: string) => void;
}

export default function RedefinirSenha({ cliente, usuarioId, terminar }: Props) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [salva, setSalva] = useState(false);

  async function voltar(aviso = '') {
    const { error } = await cliente.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Não foi possível voltar ao login. Tente novamente.');
    terminar(aviso);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    if (senha !== confirmacao) { setErro('As senhas não coincidem.'); return; }
    setOcupado(true); setErro('');
    try {
      const { data, error: erroSessao } = await cliente.auth.getUser();
      if (erroSessao || data.user?.id !== usuarioId) {
        throw new Error('Não foi possível validar o link. Confira a conexão ou solicite um novo link.');
      }
      const { error } = await cliente.auth.updateUser({ password: senha });
      if (error) {
        if (error.code === 'weak_password') throw new Error('Escolha uma senha mais forte.');
        if (error.code === 'same_password') throw new Error('Escolha uma senha diferente da anterior.');
        throw new Error('Não foi possível salvar a senha. Tente novamente ou solicite um novo link.');
      }
      setSalva(true); setSenha(''); setConfirmacao('');
      await voltar('Senha salva. Entre com seu e-mail e a nova senha.');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    setOcupado(true); setErro('');
    try { await voltar(salva ? 'Senha salva. Entre com seu e-mail e a nova senha.' : ''); }
    catch { setErro('Não foi possível voltar ao login. Tente novamente.'); }
    finally { setOcupado(false); }
  }

  return <main className="login-pagina">
    <section className="login-card login-redefinir">
      <div className="login-marca"><img src={logoCampos} alt="Farmácia Campos" /></div>
      <h1>Definir nova senha</h1>
      {!salva && <form onSubmit={enviar} aria-busy={ocupado}><fieldset disabled={ocupado}>
        <label>Nova senha<input type="password" autoComplete="new-password" required minLength={6} value={senha} onChange={e => setSenha(e.target.value)} /></label>
        <label>Confirmar nova senha<input type="password" autoComplete="new-password" required minLength={6} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></label>
        <button type="submit">{ocupado ? 'Aguarde…' : 'Salvar nova senha'}</button>
      </fieldset></form>}
      {erro && <p role="alert">{erro}</p>}
      <button type="button" className="login-link" disabled={ocupado} onClick={() => void cancelar()}>Voltar ao login</button>
    </section>
  </main>;
}
