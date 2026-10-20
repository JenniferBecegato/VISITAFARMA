const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function criarAmbiente() {
  const eventos = () => {
    const mapa = new Map();
    return { addEventListener: (nome, fn) => { if (!mapa.has(nome)) mapa.set(nome, new Set()); mapa.get(nome).add(fn); },
      removeEventListener: (nome, fn) => mapa.get(nome)?.delete(fn), disparar: nome => mapa.get(nome)?.forEach(fn => fn()) };
  };
  const janela = eventos(), documento = { ...eventos(), visibilityState: 'visible' };
  let agora = 0, seq = 0, execucoes = 0, falhar = false, invalidar = false;
  const timers = new Map(), intervalos = new Map(), estados = [], memoria = new Map();
  class SessaoInvalida extends Error {}
  class MotorSync {
    parado = false;
    async executar() { if (this.parado) return false; execucoes++; if (invalidar) throw new SessaoInvalida(); if (falhar) throw new Error('rede'); return true; }
  }
  const exports = {};
  const sandbox = { exports, navigator: { onLine: true }, window: janela, document: documento,
    localStorage: { getItem: k => memoria.get(k), setItem: (k, v) => memoria.set(k, v) },
    Date: { now: () => agora },
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => { const id = ++seq; intervalos.set(id, { fn, ms }); return id; }, clearInterval: id => intervalos.delete(id),
    require: nome => nome.includes('database/database') ? { db: {
      filaSincronizacao: { where: () => ({ equals: () => ({ count: async () => 1, modify: async () => {} }) }) },
      conflitosSync: { where: () => ({ equals: () => ({ count: async () => 0 }) }) }
    } } : nome === './syncEngine' ? { MotorSync } : { SessaoInvalida }
  };
  // Date precisa manter a construção normal para registrar a última sincronização.
  sandbox.Date = class extends Date { static now() { return agora; } };
  vm.createContext(sandbox);
  vm.runInContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/services/sincronizacao.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, sandbox);
  const drenar = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  let sessoesInvalidas = 0;
  const iniciar = () => exports.iniciarSincronizacao('u', e => estados.push(e), () => sessoesInvalidas++);
  return { sandbox, timers, intervalos, estados, iniciar, drenar,
    execucoes: () => execucoes, invalidacoes: () => sessoesInvalidas,
    falhar: valor => { falhar = valor; }, invalidar: () => { invalidar = true; },
    async avancarTimer(ms) { const item = [...timers].find(([, v]) => v.ms === ms); assert.ok(item); timers.delete(item[0]); agora += ms; item[1].fn(); await drenar(); }
  };
}
test('sincroniza na abertura, reconexão, retorno e intervalo de 60 segundos; remove os gatilhos ao parar', async () => {
  const a = criarAmbiente(); const servico = a.iniciar(); await a.drenar(); assert.equal(a.execucoes(), 1);
  a.sandbox.navigator.onLine = false; a.sandbox.window.disparar('offline'); await a.drenar();
  assert.equal(a.estados.at(-1).status, 'offline');
  a.sandbox.navigator.onLine = true; a.sandbox.window.disparar('online'); await a.drenar(); assert.equal(a.execucoes(), 2);
  a.sandbox.window.disparar('focus'); await a.drenar(); assert.equal(a.execucoes(), 3);
  const intervalo = [...a.intervalos.values()][0]; assert.equal(intervalo.ms, 60000);
  intervalo.fn(); await a.drenar(); assert.equal(a.execucoes(), 4);
  a.sandbox.window.disparar('campos-gravacao-local'); await a.avancarTimer(500); assert.equal(a.execucoes(), 5);
  servico.parar(); assert.equal(a.intervalos.size, 0);
  a.sandbox.window.disparar('online'); await a.drenar(); assert.equal(a.execucoes(), 5);
});
test('falhas aplicam espera crescente até cinco minutos e sessão rejeitada interrompe a sincronização', async () => {
  const a = criarAmbiente(); a.falhar(true); const servico = a.iniciar(); await a.drenar();
  for (const ms of [5000, 10000, 20000, 40000, 80000, 160000, 300000]) await a.avancarTimer(ms);
  assert.equal([...a.timers.values()][0].ms, 300000);
  a.falhar(false); a.invalidar(); servico.tentar(); await a.drenar();
  assert.equal(a.invalidacoes(), 1); servico.parar(); assert.equal(a.timers.size, 0);
});
