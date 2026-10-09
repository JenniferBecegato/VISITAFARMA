
import { useState, type ReactNode } from 'react';
import './Layout.css';

export type Pagina =
  | 'inicio'
  | 'agenda'
  | 'medicos'
  | 'produtos'
  | 'relatorios';

interface LayoutProps {
  children: ReactNode;
  paginaAtual: Pagina;
  navegar: (pagina: Pagina) => void;
}

const itensMenu: {
  id: Pagina;
  titulo: string;
  icone: string;
}[] = [
  { id: 'inicio', titulo: 'Início', icone: '⌂' },
  { id: 'agenda', titulo: 'Agenda', icone: '▦' },
  { id: 'medicos', titulo: 'Médicos', icone: '♙' },
  { id: 'produtos', titulo: 'Produtos', icone: '◇' },
  { id: 'relatorios', titulo: 'Relatórios', icone: '▥' }
];

export default function Layout({
  children,
  paginaAtual,
  navegar
}: LayoutProps) {
  const [menuAberto, setMenuAberto] = useState(false);

  function mudarPagina(pagina: Pagina) {
    navegar(pagina);
    setMenuAberto(false);
  }

  return (
    <div className="app-layout">
      <header className="app-cabecalho">
        <div className="app-marca">
          <div className="app-logo">C</div>

          <div>
            <strong>CAMPOS VISITAS</strong>
            <span>Visitas Farmacêuticas</span>
          </div>
        </div>

        <div className="app-cabecalho-direita">
          <span className="app-status">● Modo local</span>

          <button
            className="app-botao-menu"
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
        </div>
      </header>

      <aside className={`app-menu-lateral ${menuAberto ? 'aberto' : ''}`}>
        <nav aria-label="Menu principal">
          {itensMenu.map(item => (
            <button
              key={item.id}
              className={
                paginaAtual === item.id ? 'app-menu-ativo' : ''
              }
              onClick={() => mudarPagina(item.id)}
            >
              <span className="app-menu-icone">{item.icone}</span>
              <span>{item.titulo}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="app-conteudo">
        {children}
      </main>

      <nav className="app-menu-inferior" aria-label="Navegação inferior">
        {itensMenu.map(item => (
          <button
            key={item.id}
            className={
              paginaAtual === item.id ? 'app-menu-ativo' : ''
            }
            onClick={() => mudarPagina(item.id)}
          >
            <span className="app-menu-icone">{item.icone}</span>
            <span>{item.titulo}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
