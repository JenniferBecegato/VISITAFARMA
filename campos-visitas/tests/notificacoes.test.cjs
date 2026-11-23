const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function ambiente(etapa) {
  const pendente = () => new Promise(() => {});
  const gravacoes = [];
  const assinatura = { toJSON: () => ({ endpoint: 'https://push.example', keys: { p256dh: 'p', auth: 'a' } }) };
  const registro = { pushManager: {
    getSubscription: etapa === 'consulta' ? pendente : async () => null,
    subscribe: etapa === 'push' ? pendente : async () => assinatura,
  }, active: { postMessage: () => {} } };
  const exports = {};
  const cliente = { rpc: etapa === 'servidor' ? pendente : async () => ({ error: null }) };
  const fonte = fs.readFileSync(path.join(__dirname, '../src/services/notificacoes.ts'), 'utf8')
    .replace('import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY', JSON.stringify('AQID'));
  const contexto = vm.createContext({ exports, require: () => ({ supabase: cliente }),
    window: { isSecureContext: true, PushManager: {}, Notification: {} },
    navigator: { serviceWorker: { ready: etapa === 'worker' ? pendente() : Promise.resolve(registro) } },
    Notification: { requestPermission: etapa === 'permissao' ? pendente : async () => 'granted' },
    localStorage: { setItem: (...args) => gravacoes.push(args) },
    atob, Uint8Array, setTimeout: fn => setTimeout(fn, 5), clearTimeout });
  vm.runInContext(ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, contexto);
  return { exports, gravacoes };
}

test('ativação encerra com erro se permissão, worker, push ou servidor não responderem', async () => {
  for (const [etapa, mensagem] of Object.entries({ permissao: /permissão ficou pendente/, worker: /Atualize o app/,
    consulta: /consultar as notificações/, push: /serviço de notificações não respondeu/, servidor: /servidor não confirmou/ })) {
    const a = ambiente(etapa);
    await assert.rejects(a.exports.ativarNotificacoes('u1'), mensagem);
    assert.equal(a.gravacoes.length, 0);
  }
});

test('ativação registra o aparelho apenas após confirmação do servidor', async () => {
  const a = ambiente();
  await a.exports.ativarNotificacoes('u1');
  assert.deepEqual(a.gravacoes, [['campos-push-usuario', 'u1']]);
});
