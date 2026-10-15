const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function ambiente() {
  const clone = value => value === undefined ? undefined : structuredClone(value);
  function tabela() {
    const linhas = new Map();
    return { linhas,
      get: async id => clone(linhas.get(id)),
      put: async row => { linhas.set(row.id, clone(row)); return row.id; },
      update: async (id, dados) => { linhas.set(id, { ...linhas.get(id), ...clone(dados) }); },
      where: campo => ({ equals: valor => {
        let filtro = row => row[campo] === valor;
        const consulta = { filter: predicado => { const antes = filtro; filtro = row => antes(row) && predicado(row); return consulta; },
          toArray: async () => [...linhas.values()].filter(filtro).map(clone) };
        return consulta;
      } })
    };
  }
  const db = { produtos: tabela(), medicos: tabela(), secretarias: tabela(), visitaProdutos: tabela() };
  let fila = Promise.resolve();
  db.transaction = (...args) => {
    const tabelas = args.slice(1, -1);
    const operacao = args.at(-1);
    const resultado = fila.catch(() => {}).then(async () => {
      const backup = tabelas.map(t => new Map([...t.linhas].map(([id, row]) => [id, clone(row)])));
      try { return await operacao(); } catch (erro) {
        tabelas.forEach((t, i) => { t.linhas.clear(); backup[i].forEach((row, id) => t.linhas.set(id, row)); });
        throw erro;
      }
    });
    fila = resultado;
    return resultado;
  };
  let sequencia = 0;
  const exports = {};
  const texto = { normalizarTexto: valor => valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ') };
  const sandbox = { exports, require: nome => nome === './database' ? { db, gerarId: () => `id-${++sequencia}`, dataAtual: () => 'agora' } : texto };
  vm.createContext(sandbox);
  const fonte = fs.readFileSync(path.join(__dirname, '../src/database/catalogos.ts'), 'utf8');
  vm.runInContext(ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return { ...exports, db };
}

test('produtos: validação, duplicidade concorrente, edição e isolamento', async () => {
  const a = ambiente();
  const dados = { nome: ' Vitamina C ', ativo: true };
  await assert.rejects(a.salvarProduto('a', { nome: ' ', ativo: true }), /nome/);
  const resultados = await Promise.allSettled([a.salvarProduto('a', dados), a.salvarProduto('a', { ...dados, nome: 'VITAMINA C' })]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  const primeiro = [...a.db.produtos.linhas.values()][0];
  assert.equal(primeiro.nome, 'Vitamina C');
  await assert.rejects(a.salvarProduto('b', dados, primeiro.id), /não encontrado/);
  await a.salvarProduto('a', { ...dados, ativo: false }, primeiro.id);
  assert.equal(a.db.produtos.linhas.size, 1);
  assert.equal(a.db.produtos.linhas.get(primeiro.id).ativo, false);
  await a.salvarProduto('b', dados);
  assert.equal(a.db.produtos.linhas.size, 2);
});

test('secretária: vários médicos e bloqueio de vínculos de outra usuária', async () => {
  const a = ambiente();
  for (const id of ['m1', 'm2']) await a.db.medicos.put({ id, usuarioId: 'a' });
  await a.db.medicos.put({ id: 'outro', usuarioId: 'b' });
  await assert.rejects(a.salvarSecretaria('a', { nome: 'Ana', medicoIds: [] }), /médico/);
  await assert.rejects(a.salvarSecretaria('a', { nome: 'Ana', medicoIds: ['m1', 'outro'] }), /inválido/);
  assert.equal(a.db.secretarias.linhas.size, 0);
  await a.salvarSecretaria('a', { nome: ' Ana ', medicoIds: ['m1', 'm2', 'm1'] });
  const s = [...a.db.secretarias.linhas.values()][0];
  assert.equal(s.nome, 'Ana'); assert.equal(s.medicoIds.length, 2); assert.equal(s.medicoId, 'm1');
});

test('produtos por visita: reenvio idempotente, quantidade, remoção lógica e restauração', async () => {
  const a = ambiente();
  await a.db.produtos.put({ id: 'p', usuarioId: 'a', ativo: true });
  const itens = [{ produtoId: 'p', nome: 'Produto', quantidadeAmostras: 3 }];
  const gravar = itens => a.db.transaction('rw', a.db.visitaProdutos, a.db.produtos, () => a.gravarProdutosDaVisita('a', 'v', itens));
  await gravar(itens); await gravar(itens);
  assert.equal(a.db.visitaProdutos.linhas.size, 1);
  const id = [...a.db.visitaProdutos.linhas.keys()][0];
  await assert.rejects(gravar([{ ...itens[0], quantidadeAmostras: 1.5 }]), /inteira/);
  assert.equal(a.db.visitaProdutos.linhas.get(id).quantidadeAmostras, 3);
  await gravar([]); assert.equal(a.db.visitaProdutos.linhas.get(id).excluidoEm, 'agora');
  await gravar(itens); assert.equal(a.db.visitaProdutos.linhas.get(id).excluidoEm, undefined);
  assert.equal(a.db.visitaProdutos.linhas.size, 1);
  await assert.rejects(gravar([...itens, { produtoId: 'inexistente', quantidadeAmostras: 0 }]), /indisponível/);
  assert.equal(a.db.visitaProdutos.linhas.size, 1);
});


test('médico salva várias secretárias sem duplicar contatos e recupera os identificadores', async () => {
  const a = ambiente();
  await a.db.medicos.put({ id: 'm', usuarioId: 'u' });
  const salvar = campos => a.db.transaction('rw', a.db.medicos, a.db.secretarias,
    () => a.gravarSecretariasDoMedico('u', 'm', campos));
  await salvar([{ nome: ' Ana ' }, { nome: 'Paula' }, { nome: 'Lúcia' }]);
  const medico = await a.db.medicos.get('m');
  assert.equal(medico.secretariaIds.length, 3);
  assert.equal(medico.secretariaId, medico.secretariaIds[0]);
  const contatos = await Promise.all(medico.secretariaIds.map(id => a.db.secretarias.get(id)));
  assert.equal(contatos.map(s => s.nome).join(','), 'Ana,Paula,Lúcia');
  await salvar(contatos.map(s => ({ id: s.id, nome: s.nome })));
  assert.equal(a.db.secretarias.linhas.size, 3);
  assert.equal((await a.db.medicos.get('m')).secretariaIds.join(','), medico.secretariaIds.join(','));
});

test('secretárias exigem nomes distintos e não aceitam identificadores de outra usuária', async () => {
  const a = ambiente();
  await a.db.medicos.put({ id: 'm', usuarioId: 'u' });
  await a.db.secretarias.put({ id: 'outra', usuarioId: 'x', medicoId: 'm', nome: 'Contato privado' });
  const salvar = campos => a.db.transaction('rw', a.db.medicos, a.db.secretarias,
    () => a.gravarSecretariasDoMedico('u', 'm', campos));
  await assert.rejects(salvar([{ nome: 'Márcia' }, { nome: 'marcia' }]), /diferentes/);
  await assert.rejects(salvar([{ nome: 'Ana' }, { nome: ' ' }]), /Preencha/);
  await assert.rejects(salvar([{ id: 'outra', nome: 'Outro nome' }]), /alterado/);
  assert.equal(a.db.secretarias.linhas.size, 1);
  assert.equal((await a.db.secretarias.get('outra')).nome, 'Contato privado');
});

test('retirar uma secretária preserva o contato e o vínculo com outros médicos', async () => {
  const a = ambiente();
  await a.db.medicos.put({ id: 'm', usuarioId: 'u' });
  await a.db.secretarias.put({ id: 's', usuarioId: 'u', nome: 'Ana', medicoId: 'm', medicoIds: ['m', 'outro'], telefone: '123' });
  await a.db.transaction('rw', a.db.medicos, a.db.secretarias, () => a.gravarSecretariasDoMedico('u', 'm', []));
  const contato = await a.db.secretarias.get('s');
  assert.equal(contato.medicoIds.join(','), 'outro');
  assert.equal(contato.telefone, '123');
  assert.equal((await a.db.medicos.get('m')).secretariaIds.length, 0);
});
