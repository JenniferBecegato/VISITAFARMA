-- Verificação no Supabase hospedado: todos os dados fictícios são revertidos.
-- Executar como postgres no SQL Editor depois das duas migrações.
begin;
insert into auth.users(id) values ('95309bf1-c9cf-4de7-89d8-13778cfd6821'), ('d0e54c2b-b364-4ec3-9efb-4061a879acc5');
set local request.jwt.claim.sub = '95309bf1-c9cf-4de7-89d8-13778cfd6821';
set local role authenticated;
do $$
declare
  conta_a uuid := '95309bf1-c9cf-4de7-89d8-13778cfd6821';
  conta_b uuid := 'd0e54c2b-b364-4ec3-9efb-4061a879acc5';
  medico uuid := gen_random_uuid(); visita uuid := gen_random_uuid(); formulario uuid := gen_random_uuid(); produto uuid := gen_random_uuid();
  revisao uuid := gen_random_uuid(); lote jsonb; resposta jsonb; total integer;
begin
  lote := jsonb_build_array(jsonb_build_object('tabela','medicos','versao',0,'revisao',revisao,'registro',
    jsonb_build_object('id',medico,'usuario_id',conta_a,'nome','Teste transacional','especialidade','Clínica','dados_locais','{}'::jsonb)));
  resposta := public.sincronizar_lote(lote);
  if jsonb_array_length(resposta->'registros') <> 1 then raise exception 'Falha no envio'; end if;
  resposta := public.sincronizar_lote(lote);
  if (resposta->'registros'->0->'registro'->>'versao')::int <> 1 then raise exception 'Falha de idempotência'; end if;
  lote := jsonb_set(lote, '{0,revisao}', to_jsonb(gen_random_uuid()));
  resposta := public.sincronizar_lote(lote);
  if jsonb_array_length(resposta->'conflitos') <> 1 then raise exception 'Conflito não detectado'; end if;
  lote := jsonb_build_array(jsonb_build_object('tabela','visitas','versao',0,'revisao',gen_random_uuid(),'registro',
    jsonb_build_object('id',visita,'usuario_id',conta_a,'medico_id',medico,'data','2026-10-19','hora_inicio','14:00','status','agendada','dados_locais','{}'::jsonb)));
  perform public.sincronizar_lote(lote);
  lote := jsonb_build_array(jsonb_build_object('tabela','formularios','versao',0,'revisao',gen_random_uuid(),'registro',
    jsonb_build_object('id',formulario,'usuario_id',conta_a,'medico_id',medico,'visita_id',visita,'status','finalizado','dados','{}'::jsonb,'dados_locais','{}'::jsonb)));
  begin
    perform public.sincronizar_lote(lote);
    raise exception 'Finalização parcial foi aceita';
  exception when others then
    if sqlerrm not like '%visita realizada%' then raise; end if;
  end;
  if exists(select 1 from public.formularios where id = formulario) then raise exception 'Rollback do formulário falhou'; end if;
  lote := lote || jsonb_build_array(jsonb_build_object('tabela','visitas','versao',1,'revisao',gen_random_uuid(),'registro',
    jsonb_build_object('id',visita,'usuario_id',conta_a,'status','realizada','dados_locais','{}'::jsonb)));
  perform public.sincronizar_lote(lote);
  if not exists(select 1 from public.visitas where id = visita and status = 'realizada') then raise exception 'Finalização conjunta falhou'; end if;
  perform set_config('request.jwt.claim.sub', conta_b::text, true);
  if jsonb_array_length(public.baixar_snapshot()) <> 0 then raise exception 'Vazamento entre contas'; end if;
  select count(*) into total from public.medicos where id = medico;
  if total <> 0 then raise exception 'RLS falhou'; end if;
  begin
    perform public.sincronizar_lote(lote);
    raise exception 'Envio de outra conta foi aceito';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.sincronizar_lote(jsonb_build_array(jsonb_build_object('tabela','visitas','versao',0,'revisao',gen_random_uuid(),'registro',
      jsonb_build_object('id',gen_random_uuid(),'usuario_id',conta_b,'medico_id',medico,'data','2026-10-19','hora_inicio','14:00','status','agendada','dados_locais','{}'::jsonb))));
    raise exception 'Vínculo entre contas foi aceito';
  exception when foreign_key_violation then null;
  end;
  if has_function_privilege('anon', 'public.sincronizar_lote(jsonb)', 'EXECUTE') or
    has_function_privilege('anon', 'public.baixar_snapshot()', 'EXECUTE') then raise exception 'Permissão anônima indevida'; end if;
end;
$$;
rollback;
select 'APROVADO: envio, reenvio, conflitos, finalização atômica, RLS e isolamento. Dados fictícios revertidos.' as verificacao;
