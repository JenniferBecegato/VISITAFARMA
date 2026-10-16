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
  const db = { produtos: tabela(), visitas: tabela(), medicos: tabela(), secretarias: tabela(), formularios: tabela(), historicoReagendamentos: tabela() };
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

test('visita remarcada volta a agendada na data, inclusive após reabrir o aplicativo', async () => {
  const a = ambiente();
  for (const row of [
    { id: 'hoje', data: '2026-10-16', status: 'reagendada' },
    { id: 'passada', data: '2026-10-15', status: 'reagendada' },
    { id: 'futura', data: '2026-10-17', status: 'reagendada' },
    { id: 'realizada', data: '2026-10-15', status: 'realizada' },
    { id: 'cancelada', data: '2026-10-15', status: 'cancelada' },
    { id: 'excluida', data: '2026-10-15', status: 'reagendada', excluidoEm: 'data' },
    { id: 'outra', data: '2026-10-15', status: 'reagendada', usuarioId: 'outra' }
  ]) await a.db.visitas.put({ usuarioId: 'u', ...row });
  assert.equal(await a.atualizarVisitasRemarcadas('u', '2026-10-16'), 2);
  for (const id of ['hoje', 'passada']) {
    const visita = await a.db.visitas.get(id);
    assert.equal(visita.status, 'agendada');
    assert.equal(visita.sincronizacao, 'pendente');
  }
  for (const id of ['futura', 'excluida', 'outra']) assert.equal((await a.db.visitas.get(id)).status, 'reagendada');
  assert.equal((await a.db.visitas.get('realizada')).status, 'realizada');
  assert.equal((await a.db.visitas.get('cancelada')).status, 'cancelada');
  assert.equal(await a.atualizarVisitasRemarcadas('u', '2026-10-16'), 0);
});

test('agenda cadastra assuntos, reutiliza nomes sem acentos e preserva vínculo na edição', async () => {
  const a = ambiente();
  await a.db.medicos.put({ id: 'm', usuarioId: 'u' });
  const dados = { medicoId: 'm', data: '2026-10-20', horaInicio: '10:00', produtosAssuntos: 'Vitamina C, Saúde. vitamina c;' };
  const visita = await a.salvarAgendamento('u', dados);
  assert.equal(a.db.produtos.dados.size, 2);
  assert.equal(visita.produtoAssuntoIds.length, 2);
  assert.equal(visita.produtosAssuntos, 'Vitamina C; Saúde');
  const outra = await a.salvarAgendamento('u', { ...dados, produtosAssuntos: 'saude' });
  assert.equal(a.db.produtos.dados.size, 2);
  assert.equal(outra.produtosAssuntos, 'Saúde');
  const editada = await a.salvarAgendamento('u', { medicoId: 'm', data: '2026-10-21', horaInicio: '11:00' }, visita.id);
  assert.equal(editada.produtosAssuntos, 'Vitamina C; Saúde');
  const limpa = await a.salvarAgendamento('u', { ...dados, produtosAssuntos: '' }, visita.id);
  assert.equal(limpa.produtoAssuntoIds.length, 0);
  assert.equal(a.db.produtos.dados.size, 2);
  await a.salvarAgendamento('outra', { ...dados, medicoId: 'm' }).then(() => assert.fail('Médico de outra usuária'), () => {});
});

test('histórico limita ao ano e período inclusivo, ordena horários e reinicia no novo ano', () => {
  const { filtrarHistorico } = modulo('../src/utils/historico.ts');
  const visitas = [
    { id: 'anterior', data: '2025-12-31', horaInicio: '12:00' },
    { id: 'inicio', data: '2026-01-01', horaInicio: '08:00', status: 'cancelada' },
    { id: 'cedo', data: '2026-10-16', horaInicio: '08:00' },
    { id: 'tarde', data: '2026-10-16', horaInicio: '16:00' },
    { id: 'fim', data: '2026-12-31', horaInicio: '12:00' },
    { id: 'excluida', data: '2026-10-16', horaInicio: '10:00', excluidoEm: 'data' },
    { id: 'novo', data: '2027-01-01', horaInicio: '09:00' }
  ];
  assert.equal(filtrarHistorico(visitas, 2026, '2026-01-01', '2026-12-31').length, 4);
  assert.equal(filtrarHistorico(visitas, 2026, '2026-10-16', '2026-10-16').map(v => v.id).join(','), 'tarde,cedo');
  assert.equal(filtrarHistorico(visitas, 2027, '2027-01-01', '2027-12-31').map(v => v.id).join(','), 'novo');
  assert.equal(visitas.length, 7);
});
