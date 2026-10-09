
import { useState } from 'react';

import Layout, {
  type Pagina
} from './components/Layout';

import Medicos from './pages/Medicos';
import Inicio from './pages/Inicio';
import Agenda from './pages/Agenda';

function App() {
  const [paginaAtual, setPaginaAtual] =
    useState<Pagina>('inicio');

  function renderizarPagina() {
    switch (paginaAtual) {
      case 'inicio':
        return <Inicio />;

      case 'agenda':
          return <Agenda />;


      case 'medicos':
        return <Medicos />;

      case 'produtos':
        return (
          <div className="pagina-temporaria">
            <h1>Produtos</h1>
            <p>
              Aqui vamos cadastrar os produtos
              apresentados durante as visitas.
            </p>
          </div>
        );

      case 'relatorios':
        return (
          <div className="pagina-temporaria">
            <h1>Relatórios</h1>
            <p>
              Aqui aparecerão os relatórios de
              visitas, médicos e produtos.
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <Layout
      paginaAtual={paginaAtual}
      navegar={setPaginaAtual}
    >
      {renderizarPagina()}
    </Layout>
  );
}

export default App;
