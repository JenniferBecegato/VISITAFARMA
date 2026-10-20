import { useEffect, useRef, useState, type FormEvent } from 'react';
import { configurado, supabase } from '../services/supabase';
import { guardarConta, type Conta } from '../services/conta';
import { autenticarConta, carregarConta, PerfilIncompleto } from '../services/login';
import { lembrarEmail, lerEmailsLogin } from '../services/emailsLogin';
import { UNIDADES } from '../services/identificacao';
import './Login.css';
import logoCampos from '../assets/logo-campos.png';

export default function Login({ entrar }: { entrar: (conta: Conta) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [completar, setCompletar] = useState(false);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState<string>('');
  const [emailCadastro, setEmailCadastro] = useState('');
  const [senhaCadastro, setSenhaCadastro] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroCadastro, setErroCadastro] = useState('');
  const [emails] = useState(lerEmailsLogin);
  const modal = useRef<HTMLDialogElement>(null);
  const entrarRef = useRef(entrar);
  useEffect(() => { entrarRef.current = entrar; }, [entrar]);

  function concluir(conta: Conta) {
    guardarConta(conta); lembrarEmail(conta.email); entrarRef.current(conta);
  }
  // O listener agenda a consulta fora do callback de autenticação do Supabase.
  useEffect(() => {
    if (!supabase) return;
    const cliente = supabase;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const assinatura = cliente.auth.onAuthStateChange((evento, sessao) => {
      if (!['INITIAL_SESSION', 'SIGNED_IN'].includes(evento) || !sessao?.user) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void carregarConta(cliente, sessao.user).then(conta => {
          if (!ativo) return;
          guardarConta(conta); lembrarEmail(conta.email); entrarRef.current(conta);
        }).catch(e => {
          if (!ativo) return;
          if (e instanceof PerfilIncompleto) {
            setCompletar(true); setNome(sessao.user.user_metadata?.full_name ?? '');
            setErroCadastro(''); modal.current?.showModal();
          } else setErro(e instanceof Error ? e.message : 'Não foi possível carregar seu cadastro.');
        });
      }, 0);
    });
    return () => { ativo = false; clearTimeout(timer); assinatura.data.subscription.unsubscribe(); };
  }, []);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || !supabase) return;
    if (!navigator.onLine) { setErro('O primeiro acesso exige internet.'); return; }
    setEnviando(true); setErro(''); setAviso('');
    try { concluir(await autenticarConta(supabase, email, senha)); }
    catch (e) {
      if (e instanceof PerfilIncompleto) { setCompletar(true); setErroCadastro(''); modal.current?.showModal(); }
      else setErro(e instanceof Error ? e.message : 'Falha de conexão. Tente novamente.');
    } finally { setEnviando(false); }
  }
  async function cadastrar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || !supabase) return;
    if (!navigator.onLine) { setErroCadastro('Conecte-se à internet para cadastrar.'); return; }
    if (!nome.trim() || !UNIDADES.some(item => item === unidade)) { setErroCadastro('Informe seu nome e unidade.'); return; }
    if (!completar && senhaCadastro !== confirmacao) { setErroCadastro('As senhas não coincidem.'); return; }
    setEnviando(true); setErroCadastro('');
    try {
      if (completar) {
        const { error } = await supabase.rpc('completar_cadastro', { nome_informado: nome.trim(), unidade_informada: unidade });
        if (error) throw new Error('Não foi possível salvar o perfil. Verifique se o banco está atualizado e tente novamente.');
        const { data, error: erroUsuario } = await supabase.auth.getUser();
        if (erroUsuario || !data.user) throw new Error('Sua sessão expirou. Entre novamente.');
        concluir(await carregarConta(supabase, data.user));
      } else {
        const { data, error } = await supabase.auth.signUp({ email: emailCadastro.trim(), password: senhaCadastro,
          options: { data: { nome: nome.trim(), unidade }, emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw new Error('Não foi possível cadastrar. Verifique os dados e tente novamente. A senha deve atender às regras do serviço.');
        setSenhaCadastro(''); setConfirmacao('');
        if (data.session && data.user) concluir(await carregarConta(supabase, data.user));
        else { setEmail(emailCadastro.trim()); setAviso('Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, entre com sua senha.'); modal.current?.close(); }
      }
    } catch (e) { setErroCadastro(e instanceof Error ? e.message : 'Falha de conexão. Tente novamente.'); }
    finally { setEnviando(false); }
  }
  async function google() {
    if (!supabase || enviando) return;
    if (!navigator.onLine) { setErroCadastro('Conecte-se à internet para continuar com Google.'); setErro('Conecte-se à internet para continuar com Google.'); return; }
    setEnviando(true); setErro(''); setErroCadastro('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' }
      } });
      if (error) throw error;
    } catch { const mensagem = 'Não foi possível iniciar o acesso com Google. Verifique se o provedor está habilitado no Supabase.'; setErroCadastro(mensagem); setErro(mensagem); }
    finally { setEnviando(false); }
  }
  function abrirCadastro() {
    setCompletar(false); setErroCadastro(''); setNome(''); setUnidade('');
    setEmailCadastro(email); setSenhaCadastro(''); setConfirmacao(''); modal.current?.showModal();
  }
  return <main className="login-pagina"><section className="login-card">
    <div className="login-marca"><img src={logoCampos} alt="Farmácia Campos" /></div>
    <h1>Campos Visitas Farmacêuticas</h1>
    <form onSubmit={enviar}><fieldset disabled={enviando} style={{ border: 0, padding: 0, margin: 0 }}>
      <label>Login (e-mail)<input type="email" autoComplete="username" list={email.trim() ? 'emails-login' : undefined} required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <datalist id="emails-login">{emails.filter(item => item.startsWith(email.trim().toLowerCase())).map(item => <option key={item} value={item} />)}</datalist>
      <label>Senha<input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></label>
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {!configurado && <p role="alert">A conexão com o Supabase ainda não está configurada.</p>}
      <button type="submit" disabled={!configurado}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </fieldset></form>
    <p className="login-primeiro">Primeiro acesso? <button type="button" className="login-link" onClick={abrirCadastro} disabled={enviando || !configurado}>Novo cadastro</button></p>
    <button type="button" className="login-google" onClick={() => void google()} disabled={enviando || !configurado}>Continuar com Google</button>
    <p className="login-nota">Após o primeiro acesso, este aparelho pode trabalhar sem internet.</p>
    <dialog ref={modal} className="login-modal" aria-labelledby="cadastro-titulo" onCancel={e => { if (enviando) e.preventDefault(); }}>
      <h2 id="cadastro-titulo">{completar ? 'Complete seu cadastro' : 'Criar conta'}</h2>
      <p>{completar ? 'Informe seu nome e unidade para começar.' : 'Cadastre-se com seu e-mail ou sua conta Google.'}</p>
      <form onSubmit={cadastrar}><fieldset disabled={enviando}>
        <label>Nome<input autoFocus autoComplete="name" required maxLength={80} value={nome} onChange={e => setNome(e.target.value)} /></label>
        <label>Unidade<select required value={unidade} onChange={e => setUnidade(e.target.value)}><option value="">Selecione a unidade</option>{UNIDADES.map(item => <option key={item}>{item}</option>)}</select></label>
        {!completar && <>
          <label>E-mail<input type="email" autoComplete="email" required value={emailCadastro} onChange={e => setEmailCadastro(e.target.value)} /></label>
          <label>Senha<input type="password" autoComplete="new-password" required minLength={6} value={senhaCadastro} onChange={e => setSenhaCadastro(e.target.value)} /></label>
          <label>Confirmar senha<input type="password" autoComplete="new-password" required minLength={6} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></label>
        </>}
        {erroCadastro && <p role="alert">{erroCadastro}</p>}
        <button type="submit" disabled={!configurado}>{enviando ? 'Aguarde…' : completar ? 'Salvar cadastro' : 'Cadastrar'}</button>
      </fieldset></form>
      {!completar && <button type="button" className="login-google" disabled={enviando || !configurado} onClick={() => void google()}>Cadastrar com Google</button>}
      <button type="button" className="login-link" disabled={enviando} onClick={() => { modal.current?.close(); setSenhaCadastro(''); setConfirmacao(''); }}>Fechar</button>
    </dialog>
  </section></main>;
}
