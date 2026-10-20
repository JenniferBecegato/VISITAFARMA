const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const source = fs.readFileSync(root + '/src/pages/FormularioVisita.tsx', 'utf8').replace(/\r\n/g, '\n');
const block = source.slice(source.indexOf('const salvar = useCallback'), source.indexOf('useEffect(() => {\n  registrarSaida'));
function setup() {
  let stored;
  let fail = false;
  let release;
  let gate;
  const states = {};
  const context = {
    gravarRetornoDoFormulario: async () => {},
    consultaCompleta: false, useCallback: fn => fn, carregando: false, erroCarregamento: false,
    idAtual: 'f', medicoId: 'm', visitaId: 'v', usuarioId: 'u',
    dadosRef: { current: { nomeMedico: 'Inicial', status: 'rascunho' } },
    criadoEmRef: { current: 'criacao' }, versaoRef: { current: 0 },
    versaoSalvaRef: { current: 0 }, pendentesRef: { current: 0 },
    salvamentoRef: { current: Promise.resolve() }, dataAtual: () => 'agora',
    console: { error() {} },
    setDados: () => {}, setAlterado: v => states.alterado = v,
    setEstadoSalvamento: v => states.estado = v, setMensagem: () => {}, setSalvando: () => {},
    db: {
      transaction: async (...args) => args.at(-1)(),
      formularios: { get: async () => stored, put: async value => {
        if (gate) { const waiting = gate; gate = undefined; await waiting; }
        if (fail) { fail = false; throw new Error('disco'); }
        stored = value;
      } },
      visitas: { get: async () => ({ usuarioId: 'u', medicoId: 'm' }), update: async () => {} }
    }
  };
  vm.createContext(context);
  vm.runInContext(ts.transpile(block + '\nglobalThis.save = salvar; globalThis.leave = salvarAntesDeSair;', { target: ts.ScriptTarget.ES2022 }), context);
  return { c: context, states, stored: () => stored, fail: () => fail = true,
    pause: () => { gate = new Promise(r => release = r); }, release: () => release() };
}
test('fila do formulário preserva edição recente, finalização, recuperação e saída segura', async () => {
  const t = setup();
  t.pause();
  t.c.versaoRef.current = 1;
  const first = t.c.save();
  await new Promise(r => setImmediate(r));
  t.c.dadosRef.current.nomeMedico = 'Recente'; t.c.versaoRef.current = 2;
  const second = t.c.save();
  t.release();
  await first;
  assert.notEqual(t.states.estado, 'salvo', 'gravaÃ§Ã£o antiga nÃ£o sinaliza ediÃ§Ã£o nova como salva');
  await second;
  assert.equal(t.stored().nomeMedico, 'Recente');
  assert.equal(t.c.versaoSalvaRef.current, 2);
  await t.c.save(true); await t.c.save(false);
  assert.equal(t.stored().status, 'finalizado');
  t.fail(); assert.equal(await t.c.save(), false); assert.equal(t.states.estado, 'erro');
  assert.equal(await t.c.save(), true);
  t.c.dadosRef.current.nomeMedico = 'Antes de sair'; t.c.versaoRef.current++;
  assert.equal(await t.c.leave(), true);
  assert.equal(t.stored().nomeMedico, 'Antes de sair');
  t.fail(); assert.equal(await t.c.leave(), false);
});

test('consulta não grava ao abrir ou sair e exige salvar alterações antes de voltar', async () => {
  const t = setup();
  t.c.consultaCompleta = true;
  assert.equal(await t.c.leave(), true);
  assert.equal(t.stored(), undefined);
  t.c.dadosRef.current.nomeMedico = 'Alterado';
  t.c.versaoRef.current = 1;
  assert.equal(await t.c.leave(), false);
  assert.equal(t.stored(), undefined);
  assert.equal(await t.c.save(false), true);
  assert.equal(t.stored().nomeMedico, 'Alterado');
  assert.equal(await t.c.leave(), true);
});
