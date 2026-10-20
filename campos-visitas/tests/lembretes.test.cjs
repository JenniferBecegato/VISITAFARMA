const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function utilitarios() {
  const exports = {};
  const contexto = vm.createContext({ exports, Intl, Date });
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/lembretes.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, contexto);
  return exports;
}
test('lembretes às 8h de Brasília, virada de mês/ano, leitura e reagendamento', () => {
  const { selecionarLembretes, chaveLembrete, calendarioLembretes } = utilitarios();
  const visita = { id: 'v1', data: '2027-01-01', horaInicio: '09:30', status: 'agendada' };
  assert.equal(calendarioLembretes(new Date('2026-12-31T11:00:00Z')).amanha, '2027-01-01');
  assert.equal(selecionarLembretes([visita], new Set(), new Date('2026-12-31T10:59:59Z')).length, 0);
  assert.equal(selecionarLembretes([visita], new Set(), new Date('2026-12-31T11:00:00Z')).length, 1);
  const lidos = new Set([chaveLembrete(visita)]);
  assert.equal(selecionarLembretes([visita], lidos, new Date('2026-12-31T11:00:00Z')).length, 0);
  assert.equal(selecionarLembretes([{ ...visita, horaInicio: '10:00' }], lidos, new Date('2026-12-31T11:00:00Z')).length, 1);
  for (const alteracao of [{ status: 'cancelada' }, { status: 'realizada' }, { excluidoEm: '2026-12-30' }]) {
    assert.equal(selecionarLembretes([{ ...visita, ...alteracao }], new Set(), new Date('2026-12-31T11:00:00Z')).length, 0);
  }
  assert.equal(selecionarLembretes([visita], new Set(), new Date('2027-01-01T15:00:00Z')).length, 1);
  assert.equal(selecionarLembretes([visita], new Set(), new Date('2027-01-02T03:00:00Z')).length, 0);
});

test('PostgreSQL: push por conta, reserva sem duplicidade, leitura idempotente e exclusão de cancelados', async t => {
  const pg = new PGlite(); t.after(() => pg.close());
  const a = crypto.randomUUID(), b = crypto.randomUUID(), medico = crypto.randomUUID(), visita = crypto.randomUUID();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create function public.relogio_teste() returns timestamptz language sql stable as $$ select current_setting('teste.agora')::timestamptz $$;
    set teste.agora = '2026-10-31T10:59:00Z';
    insert into auth.users(id) values('${a}'),('${b}');`);
  for (const arquivo of ['202610150001_base.sql', '202610190001_sincronizacao.sql', '202610190002_perfil_usuario.sql', '202610200002_autocadastro.sql', '202610200003_notificacoes.sql']) {
    let sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations', arquivo), 'utf8');
    if (arquivo.endsWith('_notificacoes.sql')) sql = sql.replace(/\bnow\(\)/g, 'public.relogio_teste()');
    await pg.exec(sql);
  }
  await pg.exec(`insert into public.medicos(id,usuario_id,nome,especialidade) values('${medico}','${a}','Teste','Teste');
    insert into public.visitas(id,usuario_id,medico_id,data,hora_inicio) values('${visita}','${a}','${medico}','2026-11-01','09:30');
    set role authenticated; set request.jwt.claim.sub = '${a}';`);
  await assert.rejects(pg.query('select public.reservar_lembretes_push()'), /permission denied/);
  await assert.rejects(pg.query('select public.registrar_push($1,$2,$3)', ['https://127.0.0.1/push', 'x'.repeat(87), 'y'.repeat(22)]), /inválida/);
  await pg.query('select public.registrar_push($1,$2,$3)', ['https://fcm.googleapis.com/push/teste', 'x'.repeat(87), 'y'.repeat(22)]);
  await pg.exec('reset role; set role service_role;');
  assert.equal((await pg.query('select * from public.reservar_lembretes_push()')).rows.length, 0);
  await pg.exec("set teste.agora = '2026-10-31T11:00:00Z';");
  const primeira = (await pg.query('select * from public.reservar_lembretes_push()')).rows;
  assert.equal(primeira.length, 1); assert.equal(Number(primeira[0].total), 1);
  assert.equal(primeira[0].chave, `${visita}/2026-11-01/09:30`);
  assert.equal((await pg.query('select * from public.reservar_lembretes_push()')).rows.length, 0);
  await pg.exec("set teste.agora = '2026-10-31T11:06:00Z';");
  assert.equal((await pg.query('select * from public.reservar_lembretes_push()')).rows.length, 1);
  await pg.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${b}';`);
  assert.equal((await pg.query('select * from public.push_dispositivos')).rows.length, 0);
  const leitura = [{ visita_id: visita, data: '2026-11-01', hora_inicio: '09:30' }];
  await assert.rejects(pg.query('select public.ler_lembretes($1::jsonb)', [JSON.stringify(leitura)]), /não pertence/);
  await pg.exec(`set request.jwt.claim.sub = '${a}';`);
  await pg.query('select public.ler_lembretes($1::jsonb)', [JSON.stringify(leitura)]);
  await pg.query('select public.ler_lembretes($1::jsonb)', [JSON.stringify(leitura)]);
  assert.equal((await pg.query('select * from public.lembretes_lidos')).rows.length, 1);
  await pg.exec("reset role; set role service_role; set teste.agora = '2026-10-31T11:12:00Z';");
  assert.equal((await pg.query('select * from public.reservar_lembretes_push()')).rows.length, 0);
  await pg.exec(`reset role; update public.visitas set hora_inicio = '10:00' where id = '${visita}'; set role service_role;`);
  assert.equal((await pg.query('select * from public.reservar_lembretes_push()')).rows.length, 1);
  await pg.exec(`reset role; update public.visitas set status = 'cancelada' where id = '${visita}'; set role service_role;
    set teste.agora = '2026-10-31T11:18:00Z';`);
  assert.equal((await pg.query('select * from public.reservar_lembretes_push()')).rows.length, 0);
  await pg.exec('reset role; set role anon;');
  await assert.rejects(pg.query('select * from public.push_dispositivos'), /permission denied/);
  await assert.rejects(pg.query('select public.ler_lembretes($1::jsonb)', [JSON.stringify(leitura)]), /permission denied/);
});

test('service worker mostra o aviso, atualiza o selo, fecha após leitura e ignora conta encerrada', async () => {
  const { IDBFactory } = require('fake-indexeddb');
  const ouvintes = {}, exibidos = new Map(), selos = [], mensagens = [];
  const self = {
    addEventListener: (tipo, fn) => { ouvintes[tipo] = fn; },
    navigator: { setAppBadge: async total => selos.push(total), clearAppBadge: async () => selos.push(0) },
    registration: {
      showNotification: async (titulo, dados) => exibidos.set(dados.tag, { ...dados, title: titulo, close() { exibidos.delete(dados.tag); } }),
      getNotifications: async () => [...exibidos.values()]
    },
    clients: { matchAll: async () => [{ url: 'https://app.example/', postMessage: dados => mensagens.push(dados), focus: async () => {} }], openWindow: async () => {} },
    location: { origin: 'https://app.example' }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/push-worker.js'), 'utf8'), {
    self, indexedDB: new IDBFactory(), URL, Date, Number, Promise
  });
  async function executar(tipo, dados) {
    const pendencias = [];
    ouvintes[tipo]({ ...dados, waitUntil: promessa => pendencias.push(promessa) });
    await Promise.all(pendencias);
  }
  const aviso = { tipo:'lembrete', usuarioId:'a', chave:'v1/2026-10-21/09:00', total:2, expiraEm:Date.now()+60000, titulo:'Visita' };
  await executar('message', { data:{ tipo:'CONTA_PUSH', usuarioId:'a' } });
  await executar('push', { data:{ json:()=>aviso } });
  assert.equal(exibidos.size,1); assert.equal(selos.at(-1),2);
  assert.equal(mensagens[0].tipo,'ATUALIZAR_LEMBRETES');
  await executar('message', { data:{ tipo:'LEMBRETES_LIDOS', usuarioId:'a', chaves:[], lidas:[aviso.chave] } });
  assert.equal(exibidos.size,0); assert.equal(selos.at(-1),0);
  await executar('push', { data:{ json:()=>aviso } });
  assert.equal(exibidos.size,0);
  await executar('push', { data:{ json:()=>({...aviso,chave:'outro',usuarioId:'b'}) } });
  assert.equal(exibidos.size,0);
  await executar('push', { data:{ json:()=>({...aviso,chave:'expirado',expiraEm:1}) } });
  assert.equal(exibidos.size,0);
  await executar('message', { data:{ tipo:'SAIR_PUSH' } });
  await executar('push', { data:{ json:()=>({...aviso,chave:'novo'}) } });
  assert.equal(exibidos.size,0);
});
