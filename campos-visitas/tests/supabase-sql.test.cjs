const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('PostgreSQL: migrações, RLS, idempotência, conflitos e lote atômico', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    insert into auth.users values('${a}'),('${b}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const file of ['202610150001_base.sql', '202610190001_sincronizacao.sql', '202610190002_perfil_usuario.sql']) {
    await pg.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'));
  }
  const perfilId = crypto.randomUUID();
  await pg.query('insert into auth.users(id, raw_user_meta_data) values($1, $2::jsonb)', [perfilId,
    JSON.stringify({ nome: ' Jennifer ', unidade: 'Washington Luiz' })]);
  assert.deepEqual((await pg.query('select nome, unidade from public.usuarios where id = $1', [perfilId])).rows[0],
    { nome: 'Jennifer', unidade: 'Washington Luiz' });
  await assert.rejects(pg.query('insert into auth.users(id, raw_user_meta_data) values($1, $2::jsonb)', [crypto.randomUUID(),
    JSON.stringify({ nome: 'Nome', unidade: 'Unidade inexistente' })]), /check constraint/);
  await assert.rejects(pg.query('insert into public.usuarios(id,nome,unidade) values($1,$2,$3)', [a, 'Nome', null]), /not-null/);
  await pg.exec(`set role authenticated; set request.jwt.claim.sub = '${a}';`);
  await assert.rejects(pg.query('insert into public.usuarios(id,nome,unidade) values($1,$2,$3)', [a, 'Nome', 'Dr. Gurgel']), /permission denied/);
  await assert.rejects(pg.query('update public.usuarios set nome = $1 where id = $2', ['Outro nome', perfilId]), /permission denied/);
  assert.equal((await pg.query('select * from public.usuarios where id = $1', [perfilId])).rows.length, 0);
  const enviar = async lote => (await pg.query('select public.sincronizar_lote($1::jsonb) as resultado', [JSON.stringify(lote)])).rows[0].resultado;
  const snapshot = async () => (await pg.query('select public.baixar_snapshot() as dados')).rows[0].dados;
  const montar = (tabela, registro, versao = 0) => ({ tabela, registro: { ...registro, usuario_id: a,
    criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(), dados_locais: registro.dados_locais ?? {}, excluido_em: null },
    versao, revisao: crypto.randomUUID() });
  const medico = montar('medicos', { id: crypto.randomUUID(), nome: 'Médico A', especialidade: 'Clínica' });
  const produto = montar('produtos', { id: crypto.randomUUID(), nome: 'Produto A', ativo: true });
  const primeira = await enviar([medico, produto]);
  assert.equal(primeira.registros.length, 2);
  assert.equal((await enviar([medico, produto])).registros[0].registro.versao, 1);
  const mudanca = { ...produto, revisao: crypto.randomUUID(), versao: 1, registro: { ...produto.registro, nome: 'Novo produto' } };
  assert.equal((await enviar([mudanca])).registros[0].registro.versao, 2);
  const conflito = await enviar([{ ...produto, revisao: crypto.randomUUID(), versao: 1 }]);
  assert.equal(conflito.conflitos[0].registro.nome, 'Novo produto');
  const visita = montar('visitas', { id: crypto.randomUUID(), medico_id: medico.registro.id,
    data: '2026-10-19', hora_inicio: '14:00', status: 'agendada' });
  const secretaria = montar('secretarias', { id: crypto.randomUUID(), nome: 'Ana', dados_locais: { medicoIds: [medico.registro.id] } });
  await enviar([visita, secretaria]);
  assert.equal((await pg.query('select * from public.secretaria_medicos')).rows.length, 1);
  const formulario = montar('formularios', { id: crypto.randomUUID(), medico_id: medico.registro.id,
    visita_id: visita.registro.id, status: 'finalizado', dados: {} });
  await assert.rejects(enviar([formulario]), /visita realizada/);
  assert.equal((await pg.query('select count(*)::int as total from public.formularios')).rows[0].total, 0);
  const finalizacao = { ...visita, versao: 1, revisao: crypto.randomUUID(), registro: { ...visita.registro, status: 'realizada' } };
  assert.equal((await enviar([formulario, finalizacao])).registros.length, 2);
  const invalido = montar('visitas', { id: crypto.randomUUID(), medico_id: crypto.randomUUID(), data: '2026-10-19', hora_inicio: '14:00', status: 'agendada' });
  const outroProduto = montar('produtos', { id: crypto.randomUUID(), nome: 'Rollback', ativo: true });
  await assert.rejects(enviar([outroProduto, invalido]), /foreign key/);
  assert.equal((await pg.query('select count(*)::int as total from public.produtos where id = $1', [outroProduto.registro.id])).rows[0].total, 0);
  assert.equal((await snapshot()).length, 5);
  await pg.exec(`set request.jwt.claim.sub = '${b}';`);
  assert.deepEqual(await snapshot(), []);
  assert.equal((await pg.query('select * from public.medicos')).rows.length, 0);
  await assert.rejects(enviar([produto]), /Conta inválida/);
  const invasao = montar('visitas', { id: crypto.randomUUID(), medico_id: medico.registro.id, data: '2026-10-19', hora_inicio: '14:00', status: 'agendada' });
  invasao.registro.usuario_id = b;
  await assert.rejects(enviar([invasao]), /foreign key/);
  await pg.exec('reset role; set role anon;');
  await assert.rejects(snapshot(), /permission denied/);
  await assert.rejects(enviar([]), /permission denied/);
  await pg.exec('reset role;');
  const verificacao = await pg.exec(fs.readFileSync(path.join(__dirname, '../supabase/verificar_sincronizacao.sql'), 'utf8'));
  assert.match(verificacao.at(-1).rows[0].verificacao, /^APROVADO/);
  assert.equal((await pg.query("select count(*)::int as total from auth.users where id = '95309bf1-c9cf-4de7-89d8-13778cfd6821'")).rows[0].total, 0);
});
