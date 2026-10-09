
import { useState } from 'react';

import Layout, { type Pagina } from './components/Layout';

import Inicio from './pages/Inicio';
import Agenda from './pages/Agenda';
import Medicos from './pages/Medicos';
import PastaMedico from './pages/PastaMedico';
import FormularioVisita from './pages/FormularioVisita';

interface FormularioSelecionado {
  medicoId: string;
  visitaId: string;
  formularioId?: string;
}

function App() {
  const [paginaAtual, setPaginaAtual] =
    useState<Pagina>('inicio');

  const [medicoSelecionadoId, setMedicoSelecionadoId] =
    useState<string | null>(null);

  const [formularioSelecionado, setFormularioSelecionado] =
    useState<FormularioSelecionado | null>(null);

  function navegar(pagina: Pagina) {
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

    setPaginaAtual('medicos');
  }

  function voltarParaPasta() {
    setFormularioSelecionado(null);
    setPaginaAtual('medicos');
  }

  function renderizarPagina() {
    if (paginaAtual === 'medicos' && formularioSelecionado) {
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
        />
      );
    }

    switch (paginaAtual) {
      case 'inicio':
        return <Inicio />;

      case 'agenda':
        return <Agenda />;

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

      case 'produtos':
        return (
          <div className="pagina-temporaria">
            <h1>Produtos</h1>
            <p>
              Aqui vamos cadastrar os produtos apresentados
              durante as visitas.
            </p>
          </div>
        );

      case 'relatorios':
        return (
          <div className="pagina-temporaria">
            <h1>Relatórios</h1>
            <p>
              Aqui aparecerão os relatórios de visitas,
              médicos e produtos.
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <Layout paginaAtual={paginaAtual} navegar={navegar}>
      {renderizarPagina()}
    </Layout>
  );
}

export default App;
