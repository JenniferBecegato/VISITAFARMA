const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

test('sugestões persistem e-mails normalizados sem duplicar e suportam armazenamento indisponível', () => {
  const dados = new Map();
  const exports = {};
  const localStorage = { getItem: chave => dados.get(chave) ?? null, setItem: (chave, valor) => dados.set(chave, valor) };
  const contexto = vm.createContext({ exports, localStorage });
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/emailsLogin.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, contexto);
  exports.lembrarEmail(' Jennifer@Hotmail.com ');
  exports.lembrarEmail('jennifer@hotmail.com');
  assert.deepEqual(Array.from(exports.lerEmailsLogin()), ['jennifer@hotmail.com']);
  for (let i = 0; i < 15; i++) exports.lembrarEmail(`pessoa${i}@example.com`);
  assert.equal(exports.lerEmailsLogin().length, 10);
  assert.equal(exports.lerEmailsLogin()[0], 'pessoa14@example.com');
  dados.set('campos-emails-login', '{inválido');
  assert.equal(exports.lerEmailsLogin().length, 0);
  localStorage.setItem = () => { throw new Error('bloqueado'); };
  assert.doesNotThrow(() => exports.lembrarEmail('teste@example.com'));
});
