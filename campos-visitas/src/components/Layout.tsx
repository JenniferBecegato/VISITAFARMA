import iconeHistorico from '../assets/menu/historico.svg';
import iconeInicio from '../assets/menu/inicio.svg';
import iconeAgenda from '../assets/menu/agenda.svg';
import iconeMedicos from '../assets/menu/medicos.svg';
import iconeSecretarias from '../assets/menu/secretarias.svg';
import iconeFormularios from '../assets/menu/formularios.svg';
import iconeProdutos from '../assets/menu/produtos.svg';
import iconeRelatorios from '../assets/menu/relatorios.svg';

import { useState, type ReactNode } from 'react';
import './Layout.css';

import type { Identificacao } from '../services/identificacao';
import { exportarBackup } from '../services/backup';

export type Pagina =
  | 'inicio'
  | 'agenda'
  | 'medicos'
  | 'secretarias'
  | 'formularios'
  | 'produtos'
  | 'relatorios'
  | 'historico';

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
  { id: 'inicio', titulo: 'Minha Agenda', icone: iconeSecretarias },
  { id: 'agenda', titulo: 'Calendário', icone: iconeAgenda },
  { id: 'medicos', titulo: 'Médicos', icone: iconeMedicos },
  { id: 'secretarias', titulo: 'Secretárias', icone: iconeInicio },
  { id: 'formularios', titulo: 'Formulários', icone: iconeFormularios },
  { id: 'produtos', titulo: 'Produtos', icone: iconeProdutos },
  { id: 'relatorios', titulo: 'Relatórios', icone: iconeRelatorios },
  { id: 'historico', titulo: 'Histórico', icone: iconeHistorico }
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

          <div>
            <strong>CAMPOS VISITAS</strong>
            <span>Visitas Farmacêuticas</span>
          </div>
        </div>

        <div className="app-cabecalho-direita">

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
        <div className="app-identificacao"><button className="app-identificacao-link" type="button" title="Alterar identificação" onClick={() => void alterarIdentificacao()}>{identificacao.nome}</button></div>
          <button title="Baixar uma cópia dos dados deste aparelho em arquivo JSON" className="app-backup" type="button" disabled={exportando} onClick={async () => {
            setExportando(true); setBackupMensagem('');
            try {
              if (!await prepararBackup()) throw new Error('Salvamento pendente');
              await exportarBackup('usuario-local-teste'); setBackupMensagem('Backup exportado. Guarde o arquivo em um local seguro.'); }
            catch { setBackupMensagem('Erro ao exportar o backup. Tente novamente.'); }
            finally { setExportando(false); }
          }}>{exportando ? 'Exportando...' : 'Exportar backup'}</button>
        <nav aria-label="Menu principal">
          {itensMenu.map(item => (
            <button
              key={item.id}
              className={
                paginaAtual === item.id ? 'app-menu-ativo' : ''
              }
              onClick={() => mudarPagina(item.id)}
            >
              <span className="app-menu-icone" aria-hidden="true"><img src={item.icone} alt="" /></span>
              <span>{item.titulo}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="app-conteudo">
        <div className="app-identificacao-mobile">
          <button className="app-identificacao-link" type="button" title="Alterar identificação" onClick={() => void alterarIdentificacao()}>{identificacao.nome}</button>
        </div>
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
            <span className="app-menu-icone" aria-hidden="true"><img src={item.icone} alt="" /></span>
            <span>{item.titulo}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
