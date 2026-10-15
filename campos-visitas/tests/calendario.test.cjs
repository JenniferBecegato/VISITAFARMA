const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function modulo(arquivo, dependencias = {}) {
  const exports = {};
  const contexto = { exports, Date, require: nome => dependencias[nome] };
  vm.createContext(contexto);
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, arquivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, contexto);
  return exports;
}
const calendario = modulo('../src/utils/calendario.ts', { './relatorios': modulo('../src/utils/relatorios.ts') });
test('calendário alinha dias da semana e trata fevereiro bissexto e virada do ano', () => {
  const outubro = calendario.diasDoMes(2026, 9);
  assert.equal(outubro.length % 7, 0); assert.equal(outubro[0], null);
  assert.equal(outubro[4], '2026-10-01'); assert.equal(outubro.filter(Boolean).length, 31);
  assert.equal(calendario.diasDoMes(2024, 1).filter(Boolean).length, 29);
  assert.equal(calendario.diasDoMes(2026, 1).filter(Boolean).length, 28);
  assert.equal(calendario.diasDoMes(2026, 12).filter(Boolean)[0], '2027-01-01');
});
test('calendário mostra múltiplas visitas em ordem, mantém canceladas no histórico e omite exclusões', () => {
  const visitas = [
    { id: 'tarde', data: '2026-10-15', horaInicio: '14:00', status: 'agendada' },
    { id: 'cedo', data: '2026-10-15', horaInicio: '09:00', status: 'cancelada' },
    { id: 'outro', data: '2026-10-16', horaInicio: '08:00' },
    { id: 'excluido', data: '2026-10-15', horaInicio: '08:00', excluidoEm: 'data' }
  ];
  assert.equal(calendario.visitasNaData(visitas, '2026-10-15').map(v => v.id).join(','), 'cedo,tarde');
  assert.equal(visitas[0].id, 'tarde');
});
function ambiente() {
  const tabela = () => {
    const dados = new Map();
    return { dados, get: async id => dados.get(id),
      put: async row => dados.set(row.id, { ...row }), add: async row => dados.set(row.id, { ...row }),
      update: async (id, mudancas) => dados.set(id, { ...dados.get(id), ...mudancas }),
      where: campo => ({ equals: valor => ({ toArray: async () => [...dados.values()].filter(row => row[campo] === valor) }) }) };
  };
  const db = { visitas: tabela(), medicos: tabela(), secretarias: tabela(), formularios: tabela(), historicoReagendamentos: tabela() };
  db.transaction = async (...args) => args.at(-1)();
  let id = 0;
  return { db, ...modulo('../src/database/visitas.ts', { './database': { db, dataAtual: () => 'nova-versao', gerarId: () => `id-${++id}` } }) };
}
test('reagendamento preserva o registro e gera histórico com os horários anteriores', async () => {
  const a = ambiente();
  await a.db.medicos.put({ id: 'm', usuarioId: 'u' });
  await a.db.visitas.put({ id: 'v', usuarioId: 'u', medicoId: 'm', data: '2026-10-15', horaInicio: '10:00', status: 'agendada', atualizadoEm: 'antiga' });
  const visita = await a.salvarAgendamento('u', { medicoId: 'm', data: '2026-10-16', horaInicio: '11:00' }, 'v', 'antiga');
  assert.equal(visita.id, 'v'); assert.equal(visita.status, 'reagendada');
  const historico = [...a.db.historicoReagendamentos.dados.values()];
  assert.equal(historico.length, 1); assert.equal(historico[0].dataAnterior, '2026-10-15');
  assert.equal(historico[0].horaNova, '11:00');
  await assert.rejects(a.salvarAgendamento('u', { medicoId: 'm', data: '2026-10-17', horaInicio: '10:00' }, 'v', 'antiga'), /atualizada/);
  assert.equal(a.db.historicoReagendamentos.dados.size, 1);
});
test('ações respeitam proprietária, cancelamento e relatórios finalizados', async () => {
  const a = ambiente();
  await a.db.visitas.put({ id: 'v', usuarioId: 'u', status: 'agendada' });
  await assert.rejects(a.alterarSituacaoVisita('outra', 'v', 'cancelada'), /não encontrada/);
  await a.db.formularios.put({ id: 'f', visitaId: 'v', usuarioId: 'u', status: 'finalizado' });
  await assert.rejects(a.alterarSituacaoVisita('u', 'v', 'cancelada'), /finalizado/);
  await a.alterarSituacaoVisita('u', 'v', 'realizada');
  assert.equal((await a.db.visitas.get('v')).status, 'realizada');
  await assert.rejects(a.alterarSituacaoVisita('u', 'v', 'cancelada'), /realizada/);
  await a.db.visitas.put({ id: 'c', usuarioId: 'u', status: 'cancelada' });
  await assert.rejects(a.alterarSituacaoVisita('u', 'c', 'realizada'), /cancelada/);
});
test('edição não troca médico com relatório vinculado e não reagenda visita realizada', async () => {
  const a = ambiente();
  for (const id of ['m', 'n']) await a.db.medicos.put({ id, usuarioId: 'u' });
  await a.db.visitas.put({ id: 'v', usuarioId: 'u', medicoId: 'm', data: '2026-10-15', horaInicio: '10:00', status: 'agendada' });
  await a.db.formularios.put({ id: 'f', visitaId: 'v', usuarioId: 'u', status: 'rascunho' });
  await assert.rejects(a.salvarAgendamento('u', { medicoId: 'n', data: '2026-10-15', horaInicio: '10:00' }, 'v'), /relatório/);
  await a.alterarSituacaoVisita('u', 'v', 'realizada');
  await assert.rejects(a.salvarAgendamento('u', { medicoId: 'm', data: '2026-10-16', horaInicio: '10:00' }, 'v'), /realizada/);
});
