
import Dexie, { type Table } from 'dexie';

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

export interface FilaSincronizacao {
  id: string;
  usuarioId: string;

  tabela: string;
  registroId: string;

  operacao: 'criar' | 'atualizar' | 'excluir';

  criadoEm: string;
  tentativas: number;
  ultimoErro?: string;
}

// ==========================================
// BANCO DE DADOS
// ==========================================

export class CamposDatabase extends Dexie {
  medicos!: Table<Medico, string>;
  secretarias!: Table<Secretaria, string>;
  produtos!: Table<Produto, string>;
  visitas!: Table<Visita, string>;
  visitaProdutos!: Table<VisitaProduto, string>;
  formularios!: Table<FormularioVisita, string>;
  filaSincronizacao!: Table<FilaSincronizacao, string>;
  historicoReagendamentos!: Table<HistoricoReagendamento, string>;


  constructor() {
    super('CamposVisitasDB');

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
