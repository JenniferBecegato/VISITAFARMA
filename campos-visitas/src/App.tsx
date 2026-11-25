import './components/SaidaSessao.css';
import Historico from './pages/Historico';
import { atualizarVisitasRemarcadas } from './database/visitas';
import { dataLocal } from './utils/relatorios';

import { useCallback, useEffect, useRef, useState } from 'react';

import Layout, { type Pagina } from './components/Layout';

import Inicio from './pages/Inicio';
import Login from './pages/Login';
import RedefinirSenha from './pages/RedefinirSenha';
import { ContextoConta, lerConta, limparConta, type Conta } from './services/conta';
import { androidNativo, CHAVE_AUTH, supabase } from './services/supabase';
import { escutarRetornoAndroid } from './services/loginAndroid';
import { RETORNO_GOOGLE_AGENDA } from './services/googleAgenda';
import Sincronizacao from './components/Sincronizacao';
import Agenda from './pages/Agenda';
import Formularios from './pages/Formularios';
import { db, type Visita } from './database/database';
import Produtos from './pages/Produtos';
import Relatorios from './pages/Relatorios';
import Secretarias from './pages/Secretarias';
import Medicos from './pages/Medicos';
import PastaMedico from './pages/PastaMedico';
import FormularioVisita from './pages/FormularioVisita';
import { useLembretes } from './hooks/useLembretes';
import { desativarNotificacoes } from './services/notificacoes';

interface FormularioSelecionado {
  medicoId: string;
  visitaId: string;
  formularioId?: string;
}

function AplicativoConta({ identificacao, sair }: { identificacao: Conta; sair: () => void }) {
  const usuarioId = identificacao.usuarioId;
  const lembretes = useLembretes(usuarioId);
  const [paginaAtual, setPaginaAtual] =
    useState<Pagina>(() => sessionStorage.getItem(RETORNO_GOOGLE_AGENDA) ? 'agenda' : 'inicio');
  useEffect(() => { sessionStorage.removeItem(RETORNO_GOOGLE_AGENDA); }, []);
  const [erroRetornoGoogle, setErroRetornoGoogle] = useState('');
  useEffect(() => {
    if (androidNativo && supabase) return escutarRetornoAndroid(supabase, setErroRetornoGoogle);
  }, []);

  const [medicoSelecionadoId, setMedicoSelecionadoId] =
    useState<string | null>(null);

  const [formularioSelecionado, setFormularioSelecionado] =
    useState<FormularioSelecionado | null>(null);

  const saidaFormularioRef = useRef<(() => Promise<boolean>) | null>(null);
  const navegandoRef = useRef(false);
  useEffect(() => {
    const abrir = (evento: MessageEvent) => {
      if (evento.data?.tipo === 'ABRIR_LEMBRETES' && evento.data.usuarioId === usuarioId) setPaginaAtual('inicio');
    };
    navigator.serviceWorker?.addEventListener('message', abrir);
    return () => navigator.serviceWorker?.removeEventListener('message', abrir);
  }, [usuarioId]);
  const registrarSaida = useCallback((salvar: (() => Promise<boolean>) | null) => {
    saidaFormularioRef.current = salvar;
  }, []);

  async function navegar(pagina: Pagina) {
    if (navegandoRef.current) return;
    navegandoRef.current = true;
    try {
      if (saidaFormularioRef.current && !await saidaFormularioRef.current()) return;
      trocarPagina(pagina);
    } finally {
      navegandoRef.current = false;
    }
  }

  const [visitaEdicao, setVisitaEdicao] = useState<Visita>();
  const [erroNavegacao, setErroNavegacao] = useState('');
  useEffect(() => {
    const atualizar = () => {
      void atualizarVisitasRemarcadas(usuarioId, dataLocal())
        .catch(() => setErroNavegacao('Não foi possível atualizar as visitas remarcadas. Atualize a página para tentar novamente.'));
    };
    atualizar();
    const timer = window.setInterval(atualizar, 30000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [usuarioId]);


  async function prepararBackup() {
    return saidaFormularioRef.current ? saidaFormularioRef.current() : true;
  }

  const historicoNavegacao = useRef<Array<{
    pagina: Pagina;
    medicoId: string | null;
    formulario: FormularioSelecionado | null;
    visita: Visita | undefined;
    rolagem: number;
  }>>([]);

  function guardarOrigem() {
    historicoNavegacao.current.push({ pagina: paginaAtual, medicoId: medicoSelecionadoId,
      formulario: formularioSelecionado, visita: visitaEdicao, rolagem: window.scrollY });
  }

  function voltarAnterior() {
    const origem = historicoNavegacao.current.pop();
    setErroNavegacao('');
    setFormularioSelecionado(origem?.formulario ?? null);
    setMedicoSelecionadoId(origem?.medicoId ?? null);
    setVisitaEdicao(origem?.visita);
    setPaginaAtual(origem?.pagina ?? 'inicio');
    window.requestAnimationFrame(() => window.scrollTo(0, origem?.rolagem ?? 0));
  }

  function trocarPagina(pagina: Pagina) {
    guardarOrigem();
    setVisitaEdicao(undefined);
    setErroNavegacao('');
    setFormularioSelecionado(null);
    setMedicoSelecionadoId(null);
    setPaginaAtual(pagina);
  }

  function abrirPastaMedico(medicoId: string) {
    guardarOrigem();
    setFormularioSelecionado(null);
    setMedicoSelecionadoId(medicoId);
    setPaginaAtual('medicos');
  }



  function abrirFormulario(
    medicoId: string,
    visitaId: string,
    formularioId?: string
  ) {
    guardarOrigem();
    setMedicoSelecionadoId(medicoId);

    setFormularioSelecionado({
      medicoId,
      visitaId,
      formularioId
    });

    setPaginaAtual('formularios');
  }



  function editarVisita(visita: Visita) {
    guardarOrigem();
    setVisitaEdicao(visita); setPaginaAtual('agenda');
  }

  async function abrirRelatorio(visita: Visita) {
    try {
      setErroNavegacao('');
      const formularios = await db.formularios.where('visitaId').equals(visita.id)
        .filter(f => f.usuarioId === usuarioId && !f.excluidoEm).toArray();
      if (visita.status === 'cancelada' && !formularios.length) {
        setErroNavegacao('Esta visita foi cancelada e não possui formulário.'); return;
      }
      abrirFormulario(visita.medicoId, visita.id, formularios[0]?.id);
    } catch { setErroNavegacao('Não foi possível abrir o formulário. Tente novamente.'); }
  }

  function renderizarPagina() {
    if (paginaAtual === 'formularios' && formularioSelecionado) {
      return (
        <FormularioVisita
          key={
            formularioSelecionado.formularioId ??
            formularioSelecionado.visitaId
          }
          medicoId={formularioSelecionado.medicoId}
          visitaId={formularioSelecionado.visitaId}
          formularioId={formularioSelecionado.formularioId}
          consultaCompleta={Boolean(formularioSelecionado.formularioId)}
          voltar={voltarAnterior}
          registrarSaida={registrarSaida}
        />
      );
    }

    switch (paginaAtual) {
      case 'inicio':
        return <Inicio lembretes={lembretes} nomeUsuario={identificacao?.nome ?? ''} unidade={identificacao?.unidade ?? ''} editarVisita={editarVisita} abrirRelatorio={abrirRelatorio} abrirPasta={abrirPastaMedico} />;

      case 'agenda':
        return <Agenda key={visitaEdicao?.id ?? 'agenda'} visitaInicial={visitaEdicao} abrirPasta={abrirPastaMedico} abrirRelatorio={abrirRelatorio} />;

      case 'medicos':
        if (medicoSelecionadoId) {
          return (
            <PastaMedico
              medicoId={medicoSelecionadoId}
              voltar={voltarAnterior}
              abrirFormulario={abrirFormulario}
            />
          );
        }

        return <Medicos abrirPasta={abrirPastaMedico} />;

      case 'secretarias':
        return <Secretarias />;

      case 'formularios':
        return <Formularios abrir={abrirRelatorio} />;

      case 'produtos':
        return <Produtos />;

      case 'historico':
        return <Historico />;

      case 'relatorios':
        return <Relatorios />;

      default:
        return null;
    }
  }


  async function alterarIdentificacao() {
    if (!await prepararBackup()) return;
    sair();
  }

  return (
    <Layout notificacoes={lembretes} paginaAtual={paginaAtual} navegar={navegar} prepararBackup={prepararBackup} identificacao={identificacao} alterarIdentificacao={alterarIdentificacao}>
      <Sincronizacao sessaoInvalida={sair} />
      {erroNavegacao && <p role="alert">{erroNavegacao}</p>}
      {erroRetornoGoogle && <p role="alert">{erroRetornoGoogle}</p>}
      {renderizarPagina()}
    </Layout>
  );
}

const CHAVE_RECUPERACAO = 'campos-recuperacao-senha';
const retornoWebRecuperacao = !androidNativo &&
  new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';

export default function App() {
  const [usuarioRecuperacao, setUsuarioRecuperacao] = useState(() => sessionStorage.getItem(CHAVE_RECUPERACAO));
  const [aguardandoRecuperacao, setAguardandoRecuperacao] = useState(retornoWebRecuperacao && Boolean(supabase));
  const [avisoLogin, setAvisoLogin] = useState('');
  const [conta, setConta] = useState<Conta | null>(lerConta);
  const [encerrando, setEncerrando] = useState(false);
  const saindo = useRef(false);
  const sair = useCallback(() => {
    if (saindo.current) return;
    saindo.current = true;
    limparConta(); setConta(null); setEncerrando(true);
    const terminar = () => { localStorage.removeItem(CHAVE_AUTH); saindo.current = false; setEncerrando(false); };
    void desativarNotificacoes().catch(() => undefined).then(async () => {
      if (supabase) await supabase.auth.signOut({ scope: 'local' });
    }).then(terminar, terminar);
  }, []);
  useEffect(() => {
    const assinatura = supabase?.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY' && sessao) {
        sessionStorage.setItem(CHAVE_RECUPERACAO, sessao.user.id);
        setUsuarioRecuperacao(sessao.user.id);
        setAguardandoRecuperacao(false);
        return;
      }
      const contaLocal = lerConta();
      const mudouConta = sessao && contaLocal && sessao.user.id !== contaLocal.usuarioId;
      if (evento === 'SIGNED_OUT' || mudouConta) {
        limparConta(); setConta(null); void desativarNotificacoes().catch(() => undefined);
      }
    });
    let ativo = true;
    if (retornoWebRecuperacao) {
      void supabase?.auth.initialize().then(({ error }) => {
        if (!ativo || !error) return;
        setAvisoLogin('O link de recuperação é inválido ou expirou. Solicite um novo.');
        setAguardandoRecuperacao(false);
      });
    }
    const outraAba = (evento: StorageEvent) => {
      if (evento.key === 'campos-conta-offline') setConta(lerConta());
    };
    window.addEventListener('storage', outraAba);
    return () => { ativo = false; assinatura?.data.subscription.unsubscribe(); window.removeEventListener('storage', outraAba); };
  }, []);
  if (aguardandoRecuperacao) return <p role="status">Verificando link de recuperação…</p>;
  if (usuarioRecuperacao && supabase) return <RedefinirSenha
    cliente={supabase}
    usuarioId={usuarioRecuperacao}
    terminar={aviso => {
      limparConta();
      setConta(null);
      sessionStorage.removeItem(CHAVE_RECUPERACAO);
      setUsuarioRecuperacao(null);
      setAvisoLogin(aviso);
    }}
  />;
  if (encerrando) return (
    <main className="saida-sessao">
      <div className="saida-sessao-conteudo">
        <span className="saida-sessao-marca" role="img" aria-label="Farmácia Campos" />
        <span className="saida-sessao-carregamento" aria-hidden="true" />
        <p role="status">Encerrando sessão…</p>
      </div>
    </main>
  );
  if (!conta) return <Login entrar={setConta} avisoInicial={avisoLogin} />;
  return <ContextoConta.Provider value={conta}><AplicativoConta key={conta.usuarioId} identificacao={conta} sair={sair} /></ContextoConta.Provider>;
}
