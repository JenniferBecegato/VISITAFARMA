const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function ambiente(perfil = { nome: 'Jennifer', unidade: 'Washington Luiz' }) {
  const exports = {};
  const chamadas = [];
  let erroPerfil = null;
  let erroAuth = null;
  const cliente = {
    auth: { signInWithPassword: async dados => { chamadas.push(dados); return { data: { user: { id: 'jennifer-id', email: 'jennifer@hotmail.com' } }, error: erroAuth }; } },
    from: tabela => { assert.equal(tabela, 'usuarios'); return { select: campos => {
      assert.equal(campos, 'nome, unidade');
      return { eq: (campo, id) => { assert.equal(campo, 'id'); assert.equal(id, 'jennifer-id');
        return { maybeSingle: async () => ({ data: perfil, error: erroPerfil }) }; } };
    } }; }
  };
  const sandbox = { exports, require: () => ({ UNIDADES: ['Dr. Gurgel', 'Washington Luiz'] }) };
  vm.createContext(sandbox);
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/login.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, sandbox);
  return { entrar: () => exports.autenticarConta(cliente, ' jennifer@hotmail.com ', 'senha-teste'), chamadas,
    erroPerfil: () => { erroPerfil = new Error('indisponível'); }, erroAuth: () => { erroAuth = new Error('senha inválida'); } };
}
test('login usa somente credenciais e lê nome/unidade da tabela sem gravar perfil', async () => {
  const a = ambiente(); const conta = await a.entrar();
  assert.equal(conta.nome, 'Jennifer'); assert.equal(conta.unidade, 'Washington Luiz');
  assert.equal(conta.usuarioId, 'jennifer-id'); assert.equal(a.chamadas[0].email, 'jennifer@hotmail.com');
});
test('login impede entrada com perfil ausente ou incompleto e apresenta falhas de autenticação/consulta', async () => {
  for (const perfil of [null, { nome: '', unidade: 'Washington Luiz' }, { nome: 'Jennifer', unidade: null },
    { nome: 'Jennifer', unidade: 'Outra unidade' }]) await assert.rejects(ambiente(perfil).entrar(), /cadastro está incompleto/);
  const a = ambiente(); a.erroAuth(); await assert.rejects(a.entrar(), /Confira e-mail, senha/);
  const b = ambiente(); b.erroPerfil(); await assert.rejects(b.entrar(), /carregar seu cadastro/);
});
