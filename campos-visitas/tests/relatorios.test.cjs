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

test('produtos da agenda aparecem sem duplicar os vínculos do formulário', () => {
  const visitas = [
    { id: 'v1', data: '2026-10-15', status: 'realizada', produtoAssuntoIds: ['p'], produtosAssuntos: 'Vitamina C' },
    { id: 'v2', data: '2026-10-16', status: 'realizada', produtosAssuntos: 'vitamina c, Saúde. saude' },
    { id: 'v3', data: '2026-10-16', status: 'cancelada', produtosAssuntos: 'Cancelado com assunto' },
    { id: 'v4', data: '2026-09-01', status: 'realizada', produtosAssuntos: 'Fora' },
    { id: 'v5', data: '2026-10-16', status: 'agendada', produtoAssuntoIds: ['outro'] }
  ];
  const resultado = calcularRelatorio([], visitas, [{ id: 'p', nome: 'Vitamina C' }],
    [{ visitaId: 'v1', produtoId: 'p', quantidadeAmostras: 4 }], '2026-10-01', '2026-10-31');
  assert.equal(resultado.produtos.length, 4);
  const vitamina = resultado.produtos.find(p => p.nome === 'Vitamina C');
  assert.equal(vitamina.visitas, 2);
  assert.equal(vitamina.amostras, 4);
  const assunto = resultado.produtos.find(p => p.nome === 'Saúde');
  assert.equal(assunto.visitas, 1);
  assert.equal(assunto.amostras, 0);
});

test('relatório inclui textos dos formulários antigos e não duplica produto ou amostras', () => {
  const visitas = [{ id: 'v', data: '2026-10-15', status: 'realizada' }];
  const produtos = [{ id: 'p', nome: 'Vitamina C' }];
  const formularios = [
    { visitaId: 'v', produtosAbordados: 'vitamina c; Zinco', temaTrabalhado: 'Imunidade', produtosSelecionados: [{ produtoId: 'p', nome: 'Vitamina C', quantidadeAmostras: 3 }] },
    { visitaId: 'v', produtosAbordados: 'Excluído', excluidoEm: 'data' },
    { visitaId: 'outra', produtosAbordados: 'Fora' }
  ];
  const r = calcularRelatorio([], visitas, produtos, [{ visitaId: 'v', produtoId: 'p', quantidadeAmostras: 3 }], '2026-10-01', '2026-10-31', new Date(), formularios);
  assert.equal(r.produtos.length, 3);
  const vitamina = r.produtos.find(p => p.nome === 'Vitamina C');
  assert.equal(vitamina.visitas, 1);
  assert.equal(vitamina.amostras, 3);
  assert.equal(r.produtos.find(p => p.nome === 'Zinco').visitas, 1);
  assert.equal(r.produtos.find(p => p.nome === 'Imunidade').visitas, 1);
});

test('produtos e assuntos criados na agenda aparecem antes da realização do evento', () => {
  const visitas = [
    { id: 'a', data: '2026-10-18', status: 'agendada', produtoAssuntoIds: ['p'], produtosAssuntos: 'Produto da agenda' },
    { id: 'r', data: '2026-10-19', status: 'reagendada', produtosAssuntos: 'Assunto da agenda' },
    { id: 'fora', data: '2026-11-01', status: 'agendada', produtosAssuntos: 'Fora do período' }
  ];
  const resultado = calcularRelatorio([], visitas, [{ id: 'p', nome: 'Produto da agenda' }], [], '2026-10-01', '2026-10-31');
  assert.equal(resultado.realizadas, 0);
  assert.equal(resultado.produtos.length, 2);
  assert.equal(resultado.produtos.find(p => p.nome === 'Produto da agenda').visitas, 1);
  assert.equal(resultado.produtos.find(p => p.nome === 'Assunto da agenda').amostras, 0);
});

test('produto informa quantidade de eventos, médicos sem repetição e amostras no período', () => {
  const visitas = [
    { id: 'a', medicoId: 'm1', data: '2026-10-16', status: 'realizada', produtoAssuntoIds: ['p'] },
    { id: 'b', medicoId: 'm1', data: '2026-10-17', status: 'agendada', produtoAssuntoIds: ['p'] },
    { id: 'c', medicoId: 'm2', data: '2026-10-18', status: 'agendada', produtoAssuntoIds: ['p'] },
    { id: 'd', medicoId: 'm3', data: '2026-11-01', status: 'agendada', produtoAssuntoIds: ['p'] }
  ];
  const r = calcularRelatorio([{ id: 'm1', nome: 'Dra. Ana' }, { id: 'm2', nome: 'Dr. Bruno' }], visitas,
    [{ id: 'p', nome: 'Produto' }], [{ visitaId: 'a', produtoId: 'p', quantidadeAmostras: 3 }], '2026-10-01', '2026-10-31');
  assert.equal(r.produtos[0].visitas, 3);
  assert.equal(r.produtos[0].medicos.length, 2);
  assert.ok(r.produtos[0].medicos.includes('Dra. Ana'));
  assert.ok(r.produtos[0].medicos.includes('Dr. Bruno'));
  assert.equal(r.produtos[0].amostras, 3);
});

test('médicos sem visita exibem data e produtos da última realização, mesmo fora do filtro', () => {
  const r = calcularRelatorio([{ id: 'm', nome: 'Ana' }, { id: 'n', nome: 'Sem visita' }], [
    { id: 'antiga', medicoId: 'm', data: '2026-06-01', horaInicio: '10:00', status: 'realizada', produtosAssuntos: 'Antigo' },
    { id: 'ultima', medicoId: 'm', data: '2026-07-01', horaInicio: '10:00', status: 'realizada', produtosAssuntos: 'Zinco' },
    { id: 'agendada', medicoId: 'm', data: '2026-10-15', status: 'agendada', produtosAssuntos: 'Não realizado' }
  ], [], [], '2026-10-01', '2026-10-16', new Date(2026, 9, 16));
  const m = r.semVisita.find(x => x.medico.id === 'm');
  assert.equal(m.ultima, '2026-07-01');
  assert.equal(m.produtosAssuntos, 'Zinco');
  assert.equal(r.semVisita.find(x => x.medico.id === 'n').ultima, undefined);
});
