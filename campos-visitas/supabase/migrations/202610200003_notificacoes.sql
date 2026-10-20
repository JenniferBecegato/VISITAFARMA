-- Aplicar após as migrações de perfil/cadastro. Não altera visitas nem suas versões.
begin;
create table public.push_dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.push_dispositivos enable row level security;
revoke all on public.push_dispositivos from anon, authenticated;
grant select, delete on public.push_dispositivos to authenticated;
create policy push_proprio on public.push_dispositivos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

create table public.lembretes_lidos (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  visita_id uuid not null,
  data date not null,
  hora_inicio time not null,
  chave text not null,
  lido_em timestamptz not null default now(),
  primary key (usuario_id, chave),
  foreign key (visita_id, usuario_id) references public.visitas(id, usuario_id) on delete cascade
);
alter table public.lembretes_lidos enable row level security;
revoke all on public.lembretes_lidos from anon, authenticated;
grant select on public.lembretes_lidos to authenticated;
create policy leituras_proprias on public.lembretes_lidos for select to authenticated
  using (usuario_id = (select auth.uid()));

create function public.registrar_push(endereco text, chave_p256dh text, chave_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if endereco is null or length(endereco) > 4096 or
    endereco !~ '^https://([a-zA-Z0-9-]+\.)*(fcm.googleapis.com|push.services.mozilla.com|push.apple.com|notify.windows.com)/'
    or chave_p256dh is null or length(chave_p256dh) not between 40 and 200
    or chave_auth is null or length(chave_auth) not between 16 and 100 then
    raise exception 'Assinatura push inválida';
  end if;
  insert into public.push_dispositivos(usuario_id, endpoint, p256dh, auth)
    values(auth.uid(), endereco, chave_p256dh, chave_auth)
    on conflict(endpoint) do update set usuario_id = auth.uid(), p256dh = excluded.p256dh,
      auth = excluded.auth, atualizado_em = now();
end;
$$;
revoke all on function public.registrar_push(text,text,text) from public, anon;
grant execute on function public.registrar_push(text,text,text) to authenticated;

create function public.ler_lembretes(leituras jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb; visita uuid; dia date; hora time;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if jsonb_typeof(leituras) is distinct from 'array' or jsonb_array_length(leituras) > 500 then
    raise exception 'Leituras inválidas';
  end if;
  for item in select value from jsonb_array_elements(leituras) loop
    visita := (item->>'visita_id')::uuid; dia := (item->>'data')::date; hora := (item->>'hora_inicio')::time;
    if not exists(select 1 from public.visitas v where v.id = visita and v.usuario_id = auth.uid()) then
      raise exception 'Visita não pertence à conta';
    end if;
    insert into public.lembretes_lidos(usuario_id, visita_id, data, hora_inicio, chave)
      values(auth.uid(), visita, dia, hora, visita::text || '/' || dia::text || '/' || to_char(hora, 'HH24:MI'))
      on conflict(usuario_id, chave) do nothing;
  end loop;
end;
$$;
revoke all on function public.ler_lembretes(jsonb) from public, anon;
grant execute on function public.ler_lembretes(jsonb) to authenticated;

create table public.push_envios (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.push_dispositivos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  visita_id uuid not null,
  data date not null,
  hora_inicio time not null,
  chave text not null,
  tentativas integer not null default 0,
  disponivel_em timestamptz not null default now(),
  enviado_em timestamptz,
  unique(dispositivo_id, usuario_id, chave)
);
alter table public.push_envios enable row level security;
revoke all on public.push_envios from anon, authenticated;
grant all on public.push_dispositivos, public.push_envios, public.lembretes_lidos to service_role;

-- Reexecução segura: uma entrega por visita/data/horário/aparelho, com reserva de 5 minutos.
create function public.reservar_lembretes_push()
returns table(envio_id uuid, dispositivo_id uuid, usuario_id uuid, visita_id uuid, chave text,
  data date, hora_inicio time, endpoint text, p256dh text, auth text, total bigint, ttl integer)
language plpgsql security definer set search_path = '' as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  delete from public.push_envios e where e.data < hoje - 7;
  insert into public.push_envios(dispositivo_id, usuario_id, visita_id, data, hora_inicio, chave)
    select d.id, v.usuario_id, v.id, v.data, v.hora_inicio,
      v.id::text || '/' || v.data::text || '/' || to_char(v.hora_inicio, 'HH24:MI')
    from public.visitas v join public.push_dispositivos d on d.usuario_id = v.usuario_id
    where v.excluido_em is null and v.status in ('agendada','reagendada')
      and v.data between hoje and hoje + 1
      and ((v.data - 1) + time '08:00') at time zone 'America/Sao_Paulo' <= now()
      and not exists(select 1 from public.lembretes_lidos l where l.usuario_id = v.usuario_id
        and l.chave = v.id::text || '/' || v.data::text || '/' || to_char(v.hora_inicio, 'HH24:MI'))
    on conflict do nothing;
  return query
    with candidatos as (
      select e.id from public.push_envios e
      join public.push_dispositivos d on d.id = e.dispositivo_id and d.usuario_id = e.usuario_id
      join public.visitas v on v.id = e.visita_id and v.usuario_id = e.usuario_id
      where e.enviado_em is null and e.tentativas < 5 and e.disponivel_em <= now()
        and e.data between hoje and hoje + 1 and v.data = e.data and v.hora_inicio = e.hora_inicio
        and v.excluido_em is null and v.status in ('agendada','reagendada')
        and not exists(select 1 from public.lembretes_lidos l where l.usuario_id = e.usuario_id and l.chave = e.chave)
      order by e.data, e.hora_inicio limit 100 for update of e skip locked
    ), reservados as (
      update public.push_envios e set tentativas = e.tentativas + 1, disponivel_em = now() + interval '5 minutes'
        from candidatos c where e.id = c.id returning e.*
    )
    select e.id, d.id, e.usuario_id, e.visita_id, e.chave, e.data, e.hora_inicio, d.endpoint, d.p256dh, d.auth,
      (select count(*) from public.visitas v where v.usuario_id = e.usuario_id and v.excluido_em is null
        and v.status in ('agendada','reagendada') and v.data between hoje and hoje + 1
        and ((v.data - 1) + time '08:00') at time zone 'America/Sao_Paulo' <= now()
        and not exists(select 1 from public.lembretes_lidos l where l.usuario_id = v.usuario_id
          and l.chave = v.id::text || '/' || v.data::text || '/' || to_char(v.hora_inicio, 'HH24:MI'))),
      greatest(0, least(86400, extract(epoch from (((e.data + 1)::timestamp at time zone 'America/Sao_Paulo') - now()))::integer))
    from reservados e join public.push_dispositivos d on d.id = e.dispositivo_id;
end;
$$;
revoke all on function public.reservar_lembretes_push() from public, anon, authenticated;
grant execute on function public.reservar_lembretes_push() to service_role;
commit;
