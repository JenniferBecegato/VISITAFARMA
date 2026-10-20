import { useState, type FormEvent } from 'react';
import { configurado, supabase } from '../services/supabase';
import { guardarConta, type Conta } from '../services/conta';
import { autenticarConta } from '../services/login';
import './Login.css';
import logoCampos from '../assets/logo-campos.png';

export default function Login({ entrar }: { entrar: (conta: Conta) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    if (!supabase) { setErro('Configure a conexão com o Supabase.'); return; }
    if (!navigator.onLine) { setErro('O primeiro acesso exige internet.'); return; }
    setEnviando(true); setErro('');
    try {
      const conta = await autenticarConta(supabase, email, senha);
      guardarConta(conta); setSenha(''); entrar(conta);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha de conexão. Tente novamente.'); }
    finally { setEnviando(false); }
  }
  return <main className="login-pagina"><section className="login-card">
    <div className="login-marca"><img src={logoCampos} alt="Farmácia Campos" /></div>
    <h1>Campos Visitas Farmacêuticas</h1>
    <form onSubmit={enviar}><fieldset disabled={enviando} style={{ border: 0, padding: 0, margin: 0 }}>
      <label>Login (e-mail)<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Senha<input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></label>
      {erro && <p role="alert">{erro}</p>}
      {!configurado && <p role="alert">A conexão com o Supabase ainda não está configurada.</p>}
      <button type="submit" disabled={!configurado}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </fieldset></form>
    <p className="login-nota">Use sua conta previamente cadastrada. Após o primeiro acesso, este aparelho pode trabalhar sem internet.</p>
  </section></main>;
}
