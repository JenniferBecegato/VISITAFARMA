
import Dexie, { type Table } from 'dexie';
import { instalarRastreamento } from './rastreamento';
import type { Pendencia, MetadadosSync, ConflitoSync } from './syncTypes';

// ==========================================
// TIPOS GERAIS
// ==========================================

export type StatusSincronizacao =
  | 'pendente'
  | 'sincronizado'
  | 'erro';

export type StatusVisita =
  | 'agendada'
  | 'realizada'
  | 'reagendada'
  | 'cancelada';

export type PerfilMedico =
  | 'promotor'
  | 'neutro'
  | 'concorrencia';

// ==========================================
// MÉDICOS
// ==========================================

export interface Medico {
  id: string;
  usuarioId: string;

  nome: string;
  crm?: string;
  ufCrm?: string;
  especialidade: string;

  clinica?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  secretariaId?: string;
  secretariaIds?: string[];
  observacoes?: string;

  perfil?: PerfilMedico;

  criadoEm: string;
  atualizadoEm: string;

  sincronizacao: StatusSincronizacao;
  excluidoEm?: string;
}

// ==========================================
// SECRETÁRIAS
// ==========================================

export interface Secretaria {
  id: string;
  usuarioId: string;

  medicoId: string;
  medicoIds?: string[];
  localTrabalho?: string;
  nome: string;
  telefone?: string;
  observacoes?: string;

  criadoEm: string;
  atualizadoEm: string;

  sincronizacao: StatusSincronizacao;
  excluidoEm?: string;
}

// ==========================================
// PRODUTOS
// ==========================================

export interface Produto {
  id: string;
  usuarioId: string;

  nome: string;
  descricao?: string;
  categoria?: string;
  observacoes?: string;
  ativo: boolean;

  criadoEm: string;
  atualizadoEm: string;

  sincronizacao: StatusSincronizacao;
  excluidoEm?: string;
}

// ==========================================
// VISITAS
// ==========================================

export interface Visita {
  id: string;
  usuarioId: string;
  medicoId: string;

  data: string;
  horaInicio: string;
  horaFim?: string;

  local?: string;
  secretariaId?: string;

  produtosAssuntos?: string;
  produtoAssuntoIds?: string[];

  status: StatusVisita;
  observacoes?: string;

  // ID recebido depois da criação
  // do evento no Google Agenda.
  googleEventoId?: string;

  statusGoogle:
    | 'pendente'
    | 'sincronizado'
    | 'erro'
    | 'nao_aplicavel';

  criadoEm: string;
  atualizadoEm: string;

  sincronizacao: StatusSincronizacao;
  excluidoEm?: string;
}

// ==========================================
// PRODUTOS APRESENTADOS NAS VISITAS
// ==========================================

export interface VisitaProduto {
  id: string;
  usuarioId: string;

  visitaId: string;
  produtoId: string;

  quantidadeAmostras?: number;
  observacoes?: string;

  criadoEm: string;
  atualizadoEm: string;

  sincronizacao: StatusSincronizacao;
  excluidoEm?: string;
}

// ==========================================
// FORMULÁRIO DE VISITA MÉDICA
// ==========================================

export interface FormularioVisita {
  id: string;
  usuarioId: string;

  medicoId: string;
  visitaId: string;

  // Página 1
  representante: 'Adriana' | 'Patricia';
  localClinica: string;

  // Página 2
  nomeMedico: string;
  especialidade: string;
  perfilMedico?: PerfilMedico;

  // Página 3
  temaTrabalhado: string;
  produtosAbordados: string;
  produtosSelecionados?: { produtoId: string; nome: string; quantidadeAmostras: number }[];
  amostrasDeixadas: string;
  materiaisPromocionais?: string;

  // Página 4
  nivelInteresse?: 'alto' | 'medio' | 'baixo';
  duvidasComentarios?: string;
  anotacoesConcorrencia?: string;

  // Página 5
  acordadosSolicitacoes?: string;
  objetivoProximaVisita?: string;
  proximaVisitaAgendada?: boolean;
  dataProximoRetorno?: string;
  horaProximoRetorno?: string;

  // Página 6
  nomeSecretaria: string;
  anotacoesAdicionais?: string;

  status: 'rascunho' | 'finalizado';

  criadoEm: string;
  atualizadoEm: string;

  sincronizacao: StatusSincronizacao;
  excluidoEm?: string;
}


export interface HistoricoReagendamento {
  id: string;
  usuarioId: string;
  visitaId: string;

  dataAnterior: string;
  horaAnterior: string;

  dataNova: string;
  horaNova: string;

  alteradoEm: string;

  sincronizacao: StatusSincronizacao;
}


// ==========================================
// FILA DE SINCRONIZAÇÃO
// ==========================================

export type FilaSincronizacao = Pendencia;

// ==========================================
// BANCO DE DADOS
// ==========================================

export class CamposDatabase extends Dexie {
  lembretesLidos!: Table<{ id: string; usuarioId: string; chave: string; visitaId: string; data: string; horaInicio: string; enviado: number }, string>;
  medicos!: Table<Medico, string>;
  secretarias!: Table<Secretaria, string>;
  produtos!: Table<Produto, string>;
  visitas!: Table<Visita, string>;
  visitaProdutos!: Table<VisitaProduto, string>;
  formularios!: Table<FormularioVisita, string>;
  filaSincronizacao!: Table<Pendencia, string>;
  metadadosSync!: Table<MetadadosSync, string>;
  conflitosSync!: Table<ConflitoSync, string>;
  backupsLegados!: Table<{ id: string; usuarioId: string; registros: Record<string, unknown[]>; exportadoEm: string }, string>;
  historicoReagendamentos!: Table<HistoricoReagendamento, string>;


  constructor(nome = 'CamposVisitasDB') {
    super(nome);

    this.version(1).stores({
      medicos:
        'id, usuarioId, nome, crm, especialidade, sincronizacao',

      secretarias:
        'id, usuarioId, medicoId, nome, sincronizacao',

      produtos:
        'id, usuarioId, nome, ativo, sincronizacao',

      visitas:
        'id, usuarioId, medicoId, data, status, statusGoogle, sincronizacao',

      visitaProdutos:
        'id, usuarioId, visitaId, produtoId, sincronizacao',

      formularios:
        'id, usuarioId, medicoId, visitaId, status, sincronizacao',

      filaSincronizacao:
        'id, usuarioId, tabela, registroId, criadoEm'
    });

    
this.version(2).stores({
  historicoReagendamentos:
    'id, usuarioId, visitaId, alteradoEm, sincronizacao'
});

    this.version(3).stores({
      filaSincronizacao: 'id, usuarioId, tabela, registroId, criadoEm',
      metadadosSync: 'id, usuarioId',
      conflitosSync: 'id, usuarioId',
      backupsLegados: 'id, usuarioId'
    }).upgrade(async tx => {
      const nomes = ['medicos', 'secretarias', 'produtos', 'visitas', 'visitaProdutos', 'formularios', 'historicoReagendamentos'];
      const registros = Object.fromEntries(await Promise.all(nomes.map(async nome => [nome,
        await tx.table(nome).where('usuarioId').equals('usuario-local-teste').toArray()])));
      await tx.table('backupsLegados').put({ id: 'testes-v2', usuarioId: 'usuario-local-teste',
        exportadoEm: new Date().toISOString(), registros });
      await tx.table('filaSincronizacao').clear();
    });
    this.version(4).stores({ lembretesLidos: 'id, usuarioId, enviado' });
    instalarRastreamento(this);

  }
}

// Instância única do banco de dados
export const db = new CamposDatabase();

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

export function gerarId(): string {
  return crypto.randomUUID();
}

export function dataAtual(): string {
  return new Date().toISOString();
}

// Verifica se o navegador informa
// que existe conexão com a internet.
export function estaOnline(): boolean {
  return navigator.onLine;
}
