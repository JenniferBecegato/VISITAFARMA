import Historico from './pages/Historico';
import { atualizarVisitasRemarcadas } from './database/visitas';
import { dataLocal } from './utils/relatorios';

import { useCallback, useEffect, useRef, useState } from 'react';

import Layout, { type Pagina } from './components/Layout';

import Inicio from './pages/Inicio';
import Login from './pages/Login';
import { ContextoConta, lerConta, limparConta, type Conta } from './services/conta';
import { CHAVE_AUTH, supabase } from './services/supabase';
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
    useState<Pagina>('inicio');

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

  function trocarPagina(pagina: Pagina) {
    setVisitaEdicao(undefined);
    setErroNavegacao('');
    setFormularioSelecionado(null);
    setMedicoSelecionadoId(null);
    setPaginaAtual(pagina);
  }

  function abrirPastaMedico(medicoId: string) {
    setFormularioSelecionado(null);
    setMedicoSelecionadoId(medicoId);
    setPaginaAtual('medicos');
  }

  function voltarParaMedicos() {
    setFormularioSelecionado(null);
    setMedicoSelecionadoId(null);
    setPaginaAtual('medicos');
  }

  function abrirFormulario(
    medicoId: string,
    visitaId: string,
    formularioId?: string
  ) {
    setMedicoSelecionadoId(medicoId);

    setFormularioSelecionado({
      medicoId,
      visitaId,
      formularioId
    });

    setPaginaAtual('formularios');
  }

  function voltarParaPasta() {
    setFormularioSelecionado(null);
    setPaginaAtual('medicos');
  }

  function editarVisita(visita: Visita) {
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
          voltar={voltarParaPasta}
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
              voltar={voltarParaMedicos}
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
      {renderizarPagina()}
    </Layout>
  );
}

export default function App() {
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
    const assinatura = supabase?.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') { limparConta(); setConta(null); void desativarNotificacoes().catch(() => undefined); }
    });
    const outraAba = (evento: StorageEvent) => {
      if (evento.key === 'campos-conta-offline') setConta(lerConta());
    };
    window.addEventListener('storage', outraAba);
    return () => { assinatura?.data.subscription.unsubscribe(); window.removeEventListener('storage', outraAba); };
  }, []);
  if (encerrando) return <p role="status">Encerrando sessão…</p>;
  if (!conta) return <Login entrar={setConta} />;
  return <ContextoConta.Provider value={conta}><AplicativoConta key={conta.usuarioId} identificacao={conta} sair={sair} /></ContextoConta.Provider>;
}
