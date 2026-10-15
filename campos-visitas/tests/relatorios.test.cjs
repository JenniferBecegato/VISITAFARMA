const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function carregar(arquivo) {
  const exports = {};
  const contexto = { exports, Date, Map, Set };
  vm.createContext(contexto);
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, arquivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, contexto);
  return exports;
}
const { calcularRelatorio, diasAntes } = carregar('../src/utils/relatorios.ts');
const { nomesMedicosParecidos } = carregar('../src/utils/texto.ts');

test('nomes semelhantes ignoram títulos e acentos; nomes distintos não geram correspondência', () => {
  assert.equal(nomesMedicosParecidos('Dr. Fernando', 'Fernando Agra'), true);
  assert.equal(nomesMedicosParecidos('Dra. Márcia de Souza', 'Marcia Souza'), true);
  assert.equal(nomesMedicosParecidos('Fernando Agra', 'Fernando Silva'), false);
  assert.equal(nomesMedicosParecidos('Fernando Agra', 'Fernanda Agra'), false);
});

test('relatório conta apenas realizações para produtos e respeita período e exclusão', () => {
  const medicos = [{ id: 'm1', nome: 'Ana', especialidade: 'Cardiologia' }, { id: 'm2', nome: 'Bia' }];
  const visitas = [
    { id: 'v1', medicoId: 'm1', data: '2026-10-01', status: 'realizada', horaInicio: '10:00' },
    { id: 'v2', medicoId: 'm2', data: '2026-10-02', status: 'cancelada', horaInicio: '10:00' },
    { id: 'v3', medicoId: 'm2', data: '2026-09-01', status: 'realizada', horaInicio: '10:00' },
    { id: 'v4', medicoId: 'm2', data: '2026-10-04', status: 'realizada', excluidoEm: 'data', horaInicio: '10:00' }
  ];
  const resultado = calcularRelatorio(medicos, visitas, [{ id: 'p', nome: 'Produto' }], [
    { visitaId: 'v1', produtoId: 'p', quantidadeAmostras: 3 },
    { visitaId: 'v2', produtoId: 'p', quantidadeAmostras: 9 },
    { visitaId: 'v1', produtoId: 'p', quantidadeAmostras: 7, excluidoEm: 'data' }
  ], '2026-10-01', '2026-10-15', new Date(2026, 9, 15));
  assert.equal(resultado.realizadas, 1); assert.equal(resultado.medicosVisitados, 1);
  assert.equal(resultado.periodo.length, 2); assert.equal(resultado.produtos[0].amostras, 3);
  assert.equal(resultado.produtos[0].visitas, 1); assert.equal(resultado.semVisita.length, 0);
});

test('médicos sem visita usa realizações do histórico inteiro; agendamentos não renovam prazo', () => {
  const hoje = new Date(2026, 9, 15);
  const medicos = ['antigo', 'agendado', 'recente', 'nunca'].map(id => ({ id, nome: id }));
  const visitas = [
    { id: 'a', medicoId: 'antigo', status: 'realizada', data: '2026-07-01' },
    { id: 'b', medicoId: 'agendado', status: 'agendada', data: '2026-10-15' },
    { id: 'c', medicoId: 'recente', status: 'realizada', data: '2026-10-01' }
  ];
  const resultado = calcularRelatorio(medicos, visitas, [], [], '2026-10-10', '2026-10-15', hoje);
  assert.equal(resultado.semVisita.length, 3);
  assert.equal(resultado.semVisita.some(item => item.medico.id === 'recente'), false);
  assert.equal(diasAntes(29, hoje), '2026-09-16');
});
