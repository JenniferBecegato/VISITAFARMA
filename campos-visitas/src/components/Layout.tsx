import farmaceuticaAvatar from '../assets/farmaceutica-avatar.png';

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

import type { ControleLembretes } from '../hooks/useLembretes';

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
  notificacoes: Pick<ControleLembretes, 'ativo' | 'ocupado' | 'suportado' | 'alternar' | 'erro'>;
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
  notificacoes,
  children,
  identificacao,
  alterarIdentificacao,

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
          <svg className="app-marca-simbolo" viewBox="0 0 72 72" role="img" aria-label="Farmácia Campos">
            <path fill="#b49a60" d="M23 0h18a6 6 0 0 1 6 6v18H43C32 24 23 15 23 4Z" />
            <path fill="#fff" d="M0 24h21a3 3 0 0 1 3 3v14c0 4 2 7 6 7H20C9 48 0 39 0 24Z" />
            <path fill="#fff" d="M42 24h6c13 0 24 11 24 24H51a3 3 0 0 1-3-3V31c0-4-2-7-6-7Z" />
            <path fill="#b49a60" d="M23 48h12c7 0 12 5 12 12s-5 12-12 12-12-5-12-12Z" />
          </svg>

          <div>
            <strong>CAMPOS VISITAS</strong>
            <span>Visitas Farmacêuticas</span>
          </div>
        </div>

        <div className="app-cabecalho-direita">
          {paginaAtual === 'inicio' && <div className="app-notificacoes">
            <button type="button" role="switch" aria-checked={notificacoes.ativo} aria-label="Notificações"
              aria-busy={notificacoes.ocupado} aria-describedby={notificacoes.erro ? 'notificacoes-aviso' : undefined}
              className="app-notificacoes-chave" disabled={notificacoes.ocupado || !notificacoes.suportado}
              title={!notificacoes.suportado ? 'Instale o app na tela inicial para permitir notificações.' : notificacoes.ativo ? 'Desativar notificações neste aparelho' : 'Permitir notificações neste aparelho'}
              onClick={() => void notificacoes.alternar()}>
              <span className="app-notificacoes-trilho" aria-hidden="true"><span /></span>
              <span>Notificações</span>
            </button>
            {notificacoes.erro && <p id="notificacoes-aviso" className="app-notificacoes-aviso" role="alert">{notificacoes.erro}</p>}
          </div>}
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
        <div className="app-identificacao"><button className="app-identificacao-nome" type="button" title="Voltar à página de login" onClick={() => void alterarIdentificacao()}><img className="app-identificacao-avatar" src={farmaceuticaAvatar} alt="" /><span>{identificacao.nome}</span></button></div>
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
          
          <button className="app-identificacao-nome" type="button" title="Voltar à página de login" onClick={() => void alterarIdentificacao()}><img className="app-identificacao-avatar" src={farmaceuticaAvatar} alt="" /><span>{identificacao.nome}</span></button>
        </div>

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
