const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('fake-indexeddb/auto');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, file);
const { CamposDatabase } = require('../src/database/database.ts');
const { MotorSync } = require('../src/services/syncEngine.ts');
const { paraRemoto, paraLocal } = require('../src/services/syncMap.ts');
const { TABELAS_SYNC } = require('../src/database/syncTypes.ts');
const usuario = '11111111-1111-4111-8111-111111111111';
const produto = (id = crypto.randomUUID()) => ({ id, usuarioId: usuario, nome: 'Vitamina', ativo: true,
  criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(), sincronizacao: 'pendente' });
function ambiente(t) {
  const db = new CamposDatabase(`teste-sync-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const registros = new Map();
  const transporte = {
    validar: async id => assert.equal(id, usuario),
    enviar: async lote => {
      const conflitos = lote.filter(p => registros.has(p.registro.id) && registros.get(p.registro.id).registro.revisao_cliente !== p.revisao &&
        registros.get(p.registro.id).registro.versao !== p.versao).map(p => registros.get(p.registro.id));
      if (conflitos.length) return { conflitos };
      const resposta = lote.map(p => {
        const anterior = registros.get(p.registro.id)?.registro;
        const item = { tabela: p.tabela, registro: anterior?.revisao_cliente === p.revisao ? anterior : {
          ...p.registro, versao: (anterior?.versao ?? 0) + 1, revisao_cliente: p.revisao } };
        registros.set(p.registro.id, structuredClone(item)); return item;
      });
      return { registros: resposta };
    },
    baixar: async () => [...registros.values()].map(v => structuredClone(v))
  };
  return { db, registros, transporte, motor: new MotorSync(db, usuario, transporte) };
}
test('outbox atômica cobre put/update e reverte junto com a transação', async t => {
  const { db } = ambiente(t);
  const p = produto();
  await assert.rejects(db.transaction('rw', db.produtos, async () => { await db.produtos.put(p); throw new Error('abortar'); }));
  assert.equal(await db.produtos.count(), 0); assert.equal(await db.filaSincronizacao.count(), 0);
  await db.produtos.put(p);
  await db.produtos.update(p.id, { nome: 'Novo nome' });
  assert.equal(await db.filaSincronizacao.count(), 1);
  assert.equal((await db.filaSincronizacao.toArray())[0].registro.nome, 'Novo nome');
  db.close(); await db.open();
  assert.equal(await db.filaSincronizacao.count(), 1);
});
test('envio repetido após perda de resposta não duplica e mantém a revisão', async t => {
  const { db, transporte, motor, registros } = ambiente(t);
  const p = produto(); await db.produtos.put(p);
  const enviar = transporte.enviar;
  transporte.enviar = async lote => { await enviar(lote); throw new Error('retorno perdido'); };
  await assert.rejects(motor.executar(), /retorno perdido/);
  assert.equal(await db.filaSincronizacao.count(), 1);
  transporte.enviar = enviar;
  assert.equal(await motor.executar(), true);
  assert.equal(registros.size, 1); assert.equal(registros.get(p.id).registro.versao, 1);
  assert.equal(await db.filaSincronizacao.count(), 0);
  assert.equal((await db.produtos.get(p.id)).sincronizacao, 'sincronizado');
});
test('edição durante envio permanece pendente e usa a nova versão-base', async t => {
  const { db, transporte, motor, registros } = ambiente(t);
  const p = produto(); await db.produtos.put(p);
  const enviar = transporte.enviar;
  transporte.enviar = async lote => {
    const resposta = await enviar(lote);
    await db.produtos.update(p.id, { nome: 'Edição durante envio' });
    return resposta;
  };
  assert.equal(await motor.executar(), false);
  assert.equal((await db.produtos.get(p.id)).nome, 'Edição durante envio');
  assert.equal(await db.filaSincronizacao.count(), 1);
  transporte.enviar = enviar;
  assert.equal(await motor.executar(), true);
  assert.equal(registros.get(p.id).registro.versao, 2);
  assert.equal(registros.get(p.id).registro.nome, 'Edição durante envio');
});
test('dois aparelhos recebem alterações e conflito exige escolha', async t => {
  const a = ambiente(t); const b = ambiente(t);
  b.motor = new MotorSync(b.db, usuario, a.transporte);
  const p = produto(); await a.db.produtos.put(p); await a.motor.executar(); await b.motor.executar();
  assert.equal((await b.db.produtos.get(p.id)).nome, p.nome);
  await a.db.produtos.update(p.id, { nome: 'Celular' });
  await b.db.produtos.update(p.id, { nome: 'Tablet' });
  await a.motor.executar(); assert.equal(await b.motor.executar(), false);
  const conflito = (await b.db.conflitosSync.toArray())[0];
  assert.equal(conflito.local.nome, 'Tablet'); assert.equal(conflito.remoto.nome, 'Celular');
  await b.motor.resolver(conflito, 'local'); await b.motor.executar(); await a.motor.executar();
  assert.equal((await a.db.produtos.get(p.id)).nome, 'Tablet');
  assert.equal(await b.db.conflitosSync.count(), 0);
});
test('escolha remota, exclusão lógica e resposta de outra conta', async t => {
  const { db, transporte, motor, registros } = ambiente(t);
  const p = produto(); await db.produtos.put(p); await motor.executar();
  const remoto = registros.get(p.id).registro;
  remoto.nome = 'Remoto'; remoto.dados_locais.nome = 'Remoto'; remoto.versao += 1; remoto.revisao_cliente = crypto.randomUUID();
  await db.produtos.update(p.id, { nome: 'Local' }); await motor.executar();
  await motor.resolver((await db.conflitosSync.toArray())[0], 'remoto');
  assert.equal((await db.produtos.get(p.id)).nome, 'Remoto');
  await db.produtos.update(p.id, { excluidoEm: new Date().toISOString() }); await motor.executar();
  assert.ok(registros.get(p.id).registro.excluido_em);
  await assert.rejects(db.produtos.delete(p.id), /exclusão lógica/);
  transporte.baixar = async () => [{ tabela: 'produtos', registro: { ...remoto, usuario_id: 'outra' } }];
  await assert.rejects(motor.executar(), /conta ativa/);
});
test('sessão rejeitada impede envio; parar impede aplicação de resposta', async t => {
  const a = ambiente(t); const p = produto(); await a.db.produtos.put(p);
  a.transporte.validar = async () => { throw new Error('sessão inválida'); };
  await assert.rejects(a.motor.executar(), /sessão inválida/); assert.equal(a.registros.size, 0);
  a.transporte.validar = async () => {};
  const enviar = a.transporte.enviar;
  a.transporte.enviar = async lote => { const resposta = await enviar(lote); a.motor.parado = true; return resposta; };
  await a.motor.executar(); assert.equal(await a.db.filaSincronizacao.count(), 1);
});
test('mapeamento preserva campos livres, horários e vínculos', () => {
  for (const tabela of TABELAS_SYNC) {
    const p = { ...produto(), medicoIds: ['m1', 'm2'], produtosAssuntos: 'Texto livre', horaInicio: '14:30' };
    const remoto = paraRemoto(tabela, p);
    assert.deepEqual(remoto.dados_locais.medicoIds, ['m1', 'm2']);
    assert.equal(remoto.dados_locais.produtosAssuntos, 'Texto livre');
    assert.equal(remoto.dados_locais.sincronizacao, undefined);
  }
  const local = paraLocal('visitas', { id: 'v', usuario_id: usuario, dados_locais: {}, hora_inicio: '14:30:00', hora_fim: null });
  assert.equal(local.horaInicio, '14:30'); assert.equal(local.horaFim, undefined);
});

test('atualização do banco preserva snapshot dos testes e não os envia', async t => {
  const Dexie = require('dexie').default;
  const nome = `legado-${crypto.randomUUID()}`;
  const antigo = new Dexie(nome);
  antigo.version(2).stores({ medicos: 'id, usuarioId', secretarias: 'id, usuarioId', produtos: 'id, usuarioId', visitas: 'id, usuarioId',
    visitaProdutos: 'id, usuarioId', formularios: 'id, usuarioId', filaSincronizacao: 'id, usuarioId', historicoReagendamentos: 'id, usuarioId' });
  const p = { ...produto(), usuarioId: 'usuario-local-teste' };
  await antigo.table('produtos').put(p); antigo.close();
  const db = new CamposDatabase(nome); t.after(() => db.delete());
  await db.open();
  assert.equal((await db.backupsLegados.get('testes-v2')).registros.produtos[0].nome, p.nome);
  assert.equal(await db.filaSincronizacao.count(), 0);
  assert.equal((await db.produtos.get(p.id)).usuarioId, 'usuario-local-teste');
});
