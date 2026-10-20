export const TABELAS_SYNC = ['medicos', 'secretarias', 'produtos', 'visitas', 'visitaProdutos', 'formularios', 'historicoReagendamentos'] as const;
export type TabelaSync = typeof TABELAS_SYNC[number];
export interface RegistroLocal {
  id: string;
  usuarioId: string;
  sincronizacao?: 'pendente' | 'sincronizado' | 'erro';
  [campo: string]: unknown;
}
export interface Pendencia {
  id: string;
  usuarioId: string;
  tabela: TabelaSync;
  registroId: string;
  revisao: string;
  registro: RegistroLocal;
  criadoEm: string;
  tentativas: number;
}
export interface MetadadosSync {
  id: string;
  usuarioId: string;
  versao: number;
}
export interface RegistroRemoto {
  id: string;
  usuario_id: string;
  versao: number;
  revisao_cliente: string | null;
  dados_locais: RegistroLocal;
  [campo: string]: unknown;
}
export interface ConflitoSync {
  id: string;
  usuarioId: string;
  tabela: TabelaSync;
  registroId: string;
  local: RegistroLocal;
  remoto: RegistroRemoto;
  revisaoLocal: string;
}
export const chaveSync = (tabela: string, id: string) => `${tabela}:${id}`;
