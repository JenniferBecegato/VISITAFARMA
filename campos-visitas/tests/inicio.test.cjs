const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function carregar(arquivo, extras = {}) {
  const exports = {};
  const contexto = { exports, ...extras };
  vm.createContext(contexto);
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, arquivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, contexto);
  return exports;
}
test('visitas mudam de próximas para hoje e próximas respeitam mês e situação', () => {
  const { separarVisitas } = carregar('../src/utils/inicio.ts');
  const visitas = [
    { id: 'hoje', data: '2026-10-15', horaInicio: '23:00', status: 'agendada' },
    { id: 'amanha', data: '2026-10-16', horaInicio: '09:00', status: 'agendada' },
    { id: 'reagendada', data: '2026-10-20', horaInicio: '10:00', status: 'reagendada' },
    { id: 'outromes', data: '2026-11-01', horaInicio: '09:00', status: 'agendada' },
    { id: 'cancelada', data: '2026-10-17', horaInicio: '09:00', status: 'cancelada' },
    { id: 'excluida', data: '2026-10-18', horaInicio: '09:00', status: 'agendada', excluidoEm: 'data' },
    { id: 'realizada', data: '2026-10-19', horaInicio: '09:00', status: 'realizada' }
  ];
  const hoje = separarVisitas(visitas, '2026-10-15');
  assert.equal(hoje.visitasHoje.length, 1);
  assert.equal(hoje.proximasVisitas.map(v => v.id).join(','), 'amanha,reagendada');
  const amanha = separarVisitas(visitas, '2026-10-16');
  assert.equal(amanha.visitasHoje[0].id, 'amanha');
  assert.equal(amanha.proximasVisitas.map(v => v.id).join(','), 'reagendada');
  assert.equal(separarVisitas(visitas, '2026-10-31').proximasVisitas.length, 0);
});
test('identificação valida unidade, recupera sessão e suporta armazenamento indisponível', () => {
  const dados = new Map();
  const api = carregar('../src/services/identificacao.ts', { sessionStorage: {
    getItem: chave => dados.get(chave) ?? null,
    setItem: (chave, valor) => dados.set(chave, valor), removeItem: chave => dados.delete(chave)
  } });
  assert.equal(api.lerIdentificacao(), null);
  api.guardarIdentificacao({ nome: 'Adriana', unidade: 'Dr. Gurgel' });
  assert.equal(api.lerIdentificacao().nome, 'Adriana');
  api.guardarIdentificacao({ nome: 'Patrícia', unidade: 'Washington Luiz' });
  assert.equal(api.lerIdentificacao().unidade, 'Washington Luiz');
  api.guardarIdentificacao({ nome: 'Outra', unidade: 'Inválida' });
  assert.equal(api.lerIdentificacao(), null);
  api.limparIdentificacao(); assert.equal(api.lerIdentificacao(), null);
  const bloqueado = carregar('../src/services/identificacao.ts', { sessionStorage: {
    getItem: () => { throw new Error('indisponível'); }, setItem: () => { throw new Error('indisponível'); }, removeItem: () => { throw new Error('indisponível'); }
  } });
  assert.equal(bloqueado.lerIdentificacao(), null);
  assert.doesNotThrow(() => bloqueado.guardarIdentificacao({ nome: 'A', unidade: 'Dr. Gurgel' }));
});
