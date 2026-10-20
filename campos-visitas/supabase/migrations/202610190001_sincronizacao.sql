-- Aplicar após 202610150001_base.sql. Não contém credenciais.
begin;
alter table public.usuarios add column unidade text check (unidade in ('Dr. Gurgel', 'Washington Luiz'));
do $$
declare tabela text;
begin
  foreach tabela in array array['medicos','secretarias','produtos','visitas','visita_produtos','formularios','historico_reagendamentos'] loop
    execute format('alter table public.%I add column revisao_cliente uuid, add column dados_locais jsonb not null default ''{}''::jsonb', tabela);
  end loop;
end;
$$;

-- Um lote é uma transação: formulário, visita, amostras e vínculos não ficam parciais.
-- A revisão UUID torna seguro repetir um envio cujo retorno foi perdido.
create function public.sincronizar_lote(lote jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb; atual jsonb; novo jsonb; resultado jsonb;
  conflitos jsonb := '[]'; registros jsonb := '[]';
  tabela text; nome_local text; colunas text; secret record; vinculo record; medico text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  if jsonb_typeof(lote) <> 'array' or jsonb_array_length(lote) > 5000 then raise exception 'Lote inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  if (select count(*) <> count(distinct (value->>'tabela', value->'registro'->>'id')) from jsonb_array_elements(lote)) then
    raise exception 'Registro repetido no lote';
  end if;
  -- Bloqueia os registros existentes e verifica todas as versões antes da primeira escrita.
  for item in select value from jsonb_array_elements(lote) loop
    nome_local := item->>'tabela';
    tabela := case nome_local when 'visitaProdutos' then 'visita_produtos'
      when 'historicoReagendamentos' then 'historico_reagendamentos' else nome_local end;
    if tabela is null or not (tabela = any(array['medicos','secretarias','produtos','visitas','visita_produtos','formularios','historico_reagendamentos'])) then
      raise exception 'Tabela inválida';
    end if;
    if (item->'registro'->>'usuario_id')::uuid is distinct from auth.uid() then raise exception 'Conta inválida' using errcode = '42501'; end if;
    if (item->>'revisao')::uuid is null then raise exception 'Revisão obrigatória'; end if;
    if coalesce(item->>'versao', '') !~ '^[0-9]+$' then raise exception 'Versão obrigatória'; end if;
    execute format('select to_jsonb(t) from public.%I t where id = $1 and usuario_id = $2 for update', tabela)
      into atual using (item->'registro'->>'id')::uuid, auth.uid();
    if atual is not null and atual->>'revisao_cliente' = item->>'revisao' then continue; end if;
    if (atual is null and (item->>'versao')::bigint <> 0) or
      (atual is not null and (atual->>'versao')::bigint <> (item->>'versao')::bigint) then
      if atual is null then raise exception 'Registro remoto ausente; exclusões físicas não são suportadas'; end if;
      conflitos := conflitos || jsonb_build_array(jsonb_build_object('tabela', nome_local, 'registro', atual));
    end if;
  end loop;
  if jsonb_array_length(conflitos) > 0 then return jsonb_build_object('conflitos', conflitos); end if;

  -- Ordem fixa das dependências, independentemente da ordem das gravações locais.
  for item in select value from jsonb_array_elements(lote)
    order by array_position(array['medicos','secretarias','produtos','visitas','visitaProdutos','formularios','historicoReagendamentos'], value->>'tabela') loop
    nome_local := item->>'tabela';
    tabela := case nome_local when 'visitaProdutos' then 'visita_produtos'
      when 'historicoReagendamentos' then 'historico_reagendamentos' else nome_local end;
    execute format('select to_jsonb(t) from public.%I t where id = $1 and usuario_id = $2', tabela)
      into atual using (item->'registro'->>'id')::uuid, auth.uid();
    if atual is not null and atual->>'revisao_cliente' = item->>'revisao' then
      registros := registros || jsonb_build_array(jsonb_build_object('tabela', nome_local, 'registro', atual));
      continue;
    end if;
    novo := coalesce(atual, '{}'::jsonb) || (item->'registro') || jsonb_build_object(
      'usuario_id', auth.uid(), 'versao', coalesce((atual->>'versao')::bigint, 1),
      'revisao_cliente', (item->>'revisao')::uuid, 'atualizado_em', now());
    if atual is null then
      novo := novo || jsonb_build_object('criado_em', coalesce(nullif(novo->>'criado_em', '')::timestamptz, now()));
      execute format('insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).* returning to_jsonb(%I.*)', tabela, tabela, tabela)
        into resultado using novo;
    else
      select string_agg(format('%I = n.%I', a.attname, a.attname), ', ' order by a.attnum)
        into colunas from pg_catalog.pg_attribute a
        where a.attrelid = format('public.%I', tabela)::regclass and a.attnum > 0 and not a.attisdropped;
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) n where t.id = n.id and t.usuario_id = $2 returning to_jsonb(t.*)', tabela, colunas, tabela)
        into resultado using novo, auth.uid();
    end if;
    registros := registros || jsonb_build_array(jsonb_build_object('tabela', nome_local, 'registro', resultado));
  end loop;

  -- Representação relacional dos vínculos preservados no documento local da secretária.
  for secret in select s.* from public.secretarias s where s.usuario_id = auth.uid()
    and exists(select 1 from jsonb_array_elements(lote) e where e->>'tabela' = 'secretarias' and (e->'registro'->>'id')::uuid = s.id) loop
    for vinculo in select * from public.secretaria_medicos where secretaria_id = secret.id and usuario_id = auth.uid() loop
      if secret.excluido_em is not null or not coalesce(secret.dados_locais->'medicoIds', '[]'::jsonb) ? vinculo.medico_id::text then
        update public.secretaria_medicos set excluido_em = now() where id = vinculo.id and excluido_em is null;
      end if;
    end loop;
    if secret.excluido_em is null then
      for medico in select jsonb_array_elements_text(coalesce(secret.dados_locais->'medicoIds', '[]'::jsonb)) loop
        insert into public.secretaria_medicos(usuario_id, secretaria_id, medico_id)
          values(auth.uid(), secret.id, medico::uuid)
          on conflict(usuario_id, secretaria_id, medico_id) do update set excluido_em = null;
      end loop;
    end if;
  end loop;
  -- Valida a situação conjunta antes de confirmar a transação.
  if exists(select 1 from public.formularios f join public.visitas v on v.id = f.visita_id and v.usuario_id = f.usuario_id
    where f.usuario_id = auth.uid() and f.excluido_em is null and f.status = 'finalizado' and v.status <> 'realizada') then
    raise exception 'Formulário finalizado exige visita realizada';
  end if;
  return jsonb_build_object('registros', registros);
end;
$$;
revoke execute on function public.sincronizar_lote(jsonb) from public, anon;
grant execute on function public.sincronizar_lote(jsonb) to authenticated;

-- Snapshot por conta em uma única consulta, sem o limite de linhas da API REST.
create function public.baixar_snapshot() returns jsonb language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tabela', tabela, 'registro', registro)), '[]'::jsonb) from (
    select 'medicos' tabela, to_jsonb(t) registro from public.medicos t where usuario_id = auth.uid()
    union all select 'secretarias', to_jsonb(t) from public.secretarias t where usuario_id = auth.uid()
    union all select 'produtos', to_jsonb(t) from public.produtos t where usuario_id = auth.uid()
    union all select 'visitas', to_jsonb(t) from public.visitas t where usuario_id = auth.uid()
    union all select 'visitaProdutos', to_jsonb(t) from public.visita_produtos t where usuario_id = auth.uid()
    union all select 'formularios', to_jsonb(t) from public.formularios t where usuario_id = auth.uid()
    union all select 'historicoReagendamentos', to_jsonb(t) from public.historico_reagendamentos t where usuario_id = auth.uid()
  ) linhas;
$$;
revoke execute on function public.baixar_snapshot() from public, anon;
grant execute on function public.baixar_snapshot() to authenticated;
commit;
