import type { RegistroLocal, RegistroRemoto, TabelaSync } from '../database/syncTypes';
export const NOMES_REMOTOS: Record<TabelaSync, string> = {
  medicos: 'medicos', secretarias: 'secretarias', produtos: 'produtos', visitas: 'visitas',
  visitaProdutos: 'visita_produtos', formularios: 'formularios', historicoReagendamentos: 'historico_reagendamentos'
};
const campos: Record<TabelaSync, string[]> = {
  medicos: ['nome', 'crm', 'ufCrm', 'especialidade', 'clinica', 'endereco', 'telefone', 'email', 'observacoes', 'perfil'],
  secretarias: ['nome', 'telefone', 'localTrabalho', 'observacoes'],
  produtos: ['nome', 'categoria', 'descricao', 'observacoes', 'ativo'],
  visitas: ['medicoId', 'secretariaId', 'data', 'horaInicio', 'horaFim', 'local', 'observacoes', 'status'],
  visitaProdutos: ['visitaId', 'produtoId', 'quantidadeAmostras', 'observacoes'],
  formularios: ['medicoId', 'visitaId', 'status'],
  historicoReagendamentos: ['visitaId', 'dataAnterior', 'horaAnterior', 'dataNova', 'horaNova', 'alteradoEm']
};
const snake = (s: string) => s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
export function paraRemoto(tabela: TabelaSync, local: RegistroLocal): Record<string, unknown> {
  const extras = Object.fromEntries(Object.entries(local).filter(([k]) => k !== 'sincronizacao'));
  const remoto: Record<string, unknown> = { id: local.id, usuario_id: local.usuarioId,
    criado_em: local.criadoEm ?? local.alteradoEm, atualizado_em: local.atualizadoEm ?? local.alteradoEm,
    excluido_em: local.excluidoEm ?? null, dados_locais: extras };
  for (const campo of campos[tabela]) remoto[snake(campo)] = local[campo] ?? null;
  if (tabela === 'visitaProdutos') remoto.quantidade_amostras = local.quantidadeAmostras ?? 0;
  if (tabela === 'formularios') remoto.dados = extras;
  return remoto;
}
export function paraLocal(tabela: TabelaSync, remoto: RegistroRemoto): RegistroLocal {
  const local: RegistroLocal = { ...remoto.dados_locais, id: remoto.id,
    usuarioId: remoto.usuario_id, sincronizacao: 'sincronizado', criadoEm: remoto.criado_em,
    atualizadoEm: remoto.atualizado_em, excluidoEm: remoto.excluido_em ?? undefined };
  for (const campo of campos[tabela]) {
    const valor = remoto[snake(campo)];
    local[campo] = valor === null ? undefined : typeof valor === 'string' && /^hora/.test(campo)
      ? valor.slice(0, 5) : valor;
  }
  if (tabela === 'visitas') local.statusGoogle ??= 'nao_aplicavel';
  return local;
}
