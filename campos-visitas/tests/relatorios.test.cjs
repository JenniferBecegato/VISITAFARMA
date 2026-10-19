const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function carregar(arquivo) {
  const exports = {};
  const contexto = { exports, Date, Map, Set, require: nome => { if (nome === './relatorios') return carregar('../src/utils/relatorios.ts'); throw new Error(nome); } };
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

test('total por médico conta todo o histórico realizado, ignora outros status e exclusões e inclui zero', () => {
  const medicos = [{ id: 'm1', nome: 'Ana' }, { id: 'm2', nome: 'Bia' }, { id: 'm3', nome: 'Caio', excluidoEm: 'data' }];
  const visitas = [
    { id: '1', medicoId: 'm1', data: '2025-01-01', status: 'realizada' },
    { id: '2', medicoId: 'm1', data: '2026-10-01', status: 'realizada' },
    ...['agendada', 'reagendada', 'cancelada'].map((status, i) => ({ id: `s${i}`, medicoId: 'm1', data: '2026-10-02', status })),
    { id: '3', medicoId: 'm1', data: '2026-10-03', status: 'realizada', excluidoEm: 'data' }
  ];
  const calcular = inicio => calcularRelatorio(medicos, visitas, [], [], inicio, '2026-10-19', new Date(2026, 9, 19));
  for (const inicio of ['2026-10-01', '2026-10-15']) {
    const itens = calcular(inicio).visitasPorMedico;
    assert.equal(itens.length, 2);
    assert.equal(itens[0].medico.id, 'm1');
    assert.equal(itens[0].totalRealizadas, 2);
    assert.equal(itens[1].totalRealizadas, 0);
  }
});

test('dias sem visita usa dias de calendário desde a última realização e distingue nunca visitados', () => {
  const r = calcularRelatorio([{ id: 'm', nome: 'Ana' }, { id: 'n', nome: 'Sem visita' }], [
    { id: 'v', medicoId: 'm', data: '2026-07-01', status: 'realizada' },
    { id: 'a', medicoId: 'm', data: '2026-10-15', status: 'agendada' },
    { id: 'x', medicoId: 'm', data: '2026-10-14', status: 'realizada', excluidoEm: 'data' }
  ], [], [], '2026-10-01', '2026-10-19', new Date(2026, 9, 19, 23, 59));
  assert.equal(r.semVisita.find(x => x.medico.id === 'm').diasSemVisita, 110);
  assert.equal(r.semVisita.find(x => x.medico.id === 'n').diasSemVisita, undefined);
});

test('datas de Presidente Prudente cobrem 2026 e 2027 e preservam as categorias da fonte', () => {
  const { datasNoDia, datasNoMes, datasPresidentePrudente2027 } = carregar('../src/utils/feriados.ts');
  assert.equal(datasPresidentePrudente2027.length, 28);
  assert.equal(datasNoDia('2026-01-20')[0].tipo, 'municipal');
  assert.equal(datasNoDia('2026-12-25')[0].nome, 'Natal');
  assert.equal(datasNoMes(2026, 11).length, 5);
  assert.equal(datasNoDia('2028-01-20').length, 1);
  assert.equal(datasNoDia('2027-01-20')[0].tipo, 'municipal');
  assert.equal(datasNoDia('2027-07-09')[0].tipo, 'estadual');
  assert.equal(datasNoDia('2027-05-27').length, 2);
  assert.equal(datasNoMes(2027, 11).length, 2);
});

test('datas profissionais aparecem a cada ano sem substituir feriados no mesmo dia', () => {
  const { datasNoDia, datasNoMes } = carregar('../src/utils/feriados.ts');
  for (const ano of [2026, 2027, 2028]) {
    assert.ok(datasNoDia(`${ano}-01-20`).some(d => d.nome === 'Dia do Farmacêutico' && d.tipo === 'comemorativo'));
    assert.ok(datasNoMes(ano, 8).some(d => d.nome === 'Dia da Secretária' && d.data === `${ano}-09-30`));
    assert.ok(datasNoDia(`${ano}-10-18`).some(d => d.nome === 'Dia do Médico'));
  }
  assert.ok(datasNoDia('2026-01-20').some(d => d.tipo === 'municipal'));
});

test('lista de formulários usa data da visita, um por dia e ordem decrescente', () => {
  const { formulariosPorData } = carregar('../src/utils/formularios.ts');
  const visitas = [{ id: 'v1', data: '2026-10-15' }, { id: 'v2', data: '2026-10-19' }];
  const formularios = [
    { id: 'f1', visitaId: 'v1', criadoEm: '2026-10-15T12:00:00', atualizadoEm: '2026-10-15' },
    { id: 'f2', visitaId: 'v2', criadoEm: '2026-10-15T12:00:00', atualizadoEm: '2026-10-19' },
    { id: 'f3', visitaId: 'v1', criadoEm: '2026-10-15T12:00:00', atualizadoEm: '2026-10-20' }
  ];
  const lista = formulariosPorData(formularios, visitas);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].data, '2026-10-19');
  assert.equal(lista[0].formulario.id, 'f2');
  assert.equal(lista[1].formulario.id, 'f3');
});

test('busca de médico ignora ponto, título, acento e caixa e aceita nomes parciais', () => {
  const { correspondeBuscaMedico } = carregar('../src/utils/texto.ts');
  for (const busca of ['dr jennifer', 'dr. jennifer', 'Jennifer', 'jenn', 'dr']) {
    assert.equal(correspondeBuscaMedico('Dr. Jennifer', busca), true);
  }
  assert.equal(correspondeBuscaMedico('Dra. Márcia Souza', 'marcia'), true);
  assert.equal(correspondeBuscaMedico('Dr. Jennifer', 'Felipe'), false);
});
