
import { useState, type ReactNode } from 'react';
import './Layout.css';
import logoCampos from '../assets/logo-campos.png';
import type { Identificacao } from '../services/identificacao';
import { exportarBackup } from '../services/backup';

export type Pagina =
  | 'inicio'
  | 'agenda'
  | 'medicos'
  | 'secretarias'
  | 'formularios'
  | 'produtos'
  | 'relatorios';

interface LayoutProps {
  children: ReactNode;
  identificacao: Identificacao;
  alterarIdentificacao: () => Promise<void>;
  prepararBackup: () => Promise<boolean>;
  paginaAtual: Pagina;
  navegar: (pagina: Pagina) => void;
}

const itensMenu: {
  id: Pagina;
  titulo: string;
  icone: string;
}[] = [
  { id: 'inicio', titulo: 'Página inicial', icone: '⌂' },
  { id: 'agenda', titulo: 'Agenda', icone: '▦' },
  { id: 'medicos', titulo: 'Médicos', icone: '♙' },
  { id: 'secretarias', titulo: 'Secretárias', icone: '♧' },
  { id: 'formularios', titulo: 'Formulários', icone: '▤' },
  { id: 'produtos', titulo: 'Produtos', icone: '◇' },
  { id: 'relatorios', titulo: 'Relatórios', icone: '▥' }
];

export default function Layout({
  children,
  identificacao,
  alterarIdentificacao,
  prepararBackup,
  paginaAtual,
  navegar
}: LayoutProps) {
  const [backupMensagem, setBackupMensagem] = useState('');
  const [exportando, setExportando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  function mudarPagina(pagina: Pagina) {
    navegar(pagina);
    setMenuAberto(false);
  }

  return (
    <div className="app-layout">
      <header className="app-cabecalho">
        <div className="app-marca">
          <div className="app-logo"><img src={logoCampos} alt="Símbolo da Farmácia Campos" /></div>

          <div>
            <strong>CAMPOS VISITAS</strong>
            <span>Visitas Farmacêuticas</span>
          </div>
        </div>

        <div className="app-cabecalho-direita">
          <button title="Baixar uma cópia dos dados deste aparelho em arquivo JSON" className="app-backup" type="button" disabled={exportando} onClick={async () => {
            setExportando(true); setBackupMensagem('');
            try {
              if (!await prepararBackup()) throw new Error('Salvamento pendente');
              await exportarBackup('usuario-local-teste'); setBackupMensagem('Backup exportado. Guarde o arquivo em um local seguro.'); }
            catch { setBackupMensagem('Erro ao exportar o backup. Tente novamente.'); }
            finally { setExportando(false); }
          }}>{exportando ? 'Exportando...' : 'Exportar backup'}</button>
          <button className="app-conta" type="button" title="Alterar nome ou unidade" onClick={() => void alterarIdentificacao()}>{identificacao.nome}</button>
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
        <div className="app-identificacao"><strong>{identificacao.nome}</strong><small>Unidade {identificacao.unidade}</small>
          <button type="button" onClick={() => void alterarIdentificacao()}>Alterar identificação</button></div>
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
        {backupMensagem && <p role="status">{backupMensagem}</p>}
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
