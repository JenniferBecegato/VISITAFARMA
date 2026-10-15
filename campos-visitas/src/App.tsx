
import { useCallback, useRef, useState } from 'react';

import Layout, { type Pagina } from './components/Layout';

import Inicio from './pages/Inicio';
import Login from './pages/Login';
import { lerIdentificacao, guardarIdentificacao, limparIdentificacao, type Identificacao } from './services/identificacao';
import Agenda from './pages/Agenda';
import Formularios from './pages/Formularios';
import { db, type Visita } from './database/database';
import Produtos from './pages/Produtos';
import Relatorios from './pages/Relatorios';
import Secretarias from './pages/Secretarias';
import Medicos from './pages/Medicos';
import PastaMedico from './pages/PastaMedico';
import FormularioVisita from './pages/FormularioVisita';

interface FormularioSelecionado {
  medicoId: string;
  visitaId: string;
  formularioId?: string;
}

function App() {
  const [identificacao, setIdentificacao] = useState<Identificacao | null>(lerIdentificacao);
  const [paginaAtual, setPaginaAtual] =
    useState<Pagina>('inicio');

  const [medicoSelecionadoId, setMedicoSelecionadoId] =
    useState<string | null>(null);

  const [formularioSelecionado, setFormularioSelecionado] =
    useState<FormularioSelecionado | null>(null);

  const saidaFormularioRef = useRef<(() => Promise<boolean>) | null>(null);
  const navegandoRef = useRef(false);
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
        .filter(f => f.usuarioId === 'usuario-local-teste' && !f.excluidoEm).toArray();
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
          voltar={voltarParaPasta}
          registrarSaida={registrarSaida}
        />
      );
    }

    switch (paginaAtual) {
      case 'inicio':
        return <Inicio nomeUsuario={identificacao?.nome ?? ''} unidade={identificacao?.unidade ?? ''} editarVisita={editarVisita} abrirRelatorio={abrirRelatorio} abrirPasta={abrirPastaMedico} />;

      case 'agenda':
        return <Agenda key={visitaEdicao?.id ?? 'agenda'} visitaInicial={visitaEdicao} abrirPasta={abrirPastaMedico} />;

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

      case 'relatorios':
        return <Relatorios />;

      default:
        return null;
    }
  }

  if (!identificacao) return <Login entrar={valor => {
    guardarIdentificacao(valor); setIdentificacao(valor); trocarPagina('inicio');
  }} />;

  async function alterarIdentificacao() {
    if (!await prepararBackup()) return;
    limparIdentificacao(); setIdentificacao(null); trocarPagina('inicio');
  }

  return (
    <Layout paginaAtual={paginaAtual} navegar={navegar} prepararBackup={prepararBackup} identificacao={identificacao} alterarIdentificacao={alterarIdentificacao}>
      {erroNavegacao && <p role="alert">{erroNavegacao}</p>}
      {renderizarPagina()}
    </Layout>
  );
}

export default App;
