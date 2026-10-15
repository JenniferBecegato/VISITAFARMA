-- Preparação para um projeto Supabase novo. Ainda não aplicada a nenhum servidor.
-- Não contém contas, senhas ou chaves. A fila de envio continua local no IndexedDB.
begin;
create table public.usuarios (
  id uuid primary key references auth.users(id), nome text not null,
  criado_em timestamptz not null default now()
);
alter table public.usuarios enable row level security;
revoke all on public.usuarios from anon, authenticated;
grant select, insert, update on public.usuarios to authenticated;
create policy usuario_proprio on public.usuarios for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function public.controlar_versao() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.usuario_id <> old.usuario_id then raise exception 'Proprietário imutável'; end if;
  if new.versao <> old.versao then
    raise exception 'Conflito de versão: recarregue o registro' using errcode = '40001';
  end if;
  new.versao := old.versao + 1;
  new.criado_em := old.criado_em;
  new.atualizado_em := now();
  return new;
end;
$$;

create table public.medicos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  nome text not null check (length(trim(nome)) > 0), crm text, uf_crm text, especialidade text not null, clinica text, endereco text, telefone text, email text, observacoes text, perfil text check (perfil in ('promotor','neutro','concorrencia'))
);
alter table public.medicos enable row level security;
revoke all on public.medicos from anon, authenticated;
grant select, insert, update on public.medicos to authenticated;
create policy registros_proprios on public.medicos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index medicos_usuario_atualizacao on public.medicos(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.medicos
  for each row execute function public.controlar_versao();

create table public.secretarias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  nome text not null, telefone text, local_trabalho text, observacoes text
);
alter table public.secretarias enable row level security;
revoke all on public.secretarias from anon, authenticated;
grant select, insert, update on public.secretarias to authenticated;
create policy registros_proprios on public.secretarias for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index secretarias_usuario_atualizacao on public.secretarias(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.secretarias
  for each row execute function public.controlar_versao();

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  nome text not null check (length(trim(nome)) > 0), categoria text, descricao text, observacoes text, ativo boolean not null default true
);
alter table public.produtos enable row level security;
revoke all on public.produtos from anon, authenticated;
grant select, insert, update on public.produtos to authenticated;
create policy registros_proprios on public.produtos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index produtos_usuario_atualizacao on public.produtos(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.produtos
  for each row execute function public.controlar_versao();

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  medico_id uuid not null, secretaria_id uuid, data date not null, hora_inicio time not null, hora_fim time, local text, observacoes text, status text not null default 'agendada' check (status in ('agendada','realizada','reagendada','cancelada')), foreign key (medico_id, usuario_id) references public.medicos(id, usuario_id), foreign key (secretaria_id, usuario_id) references public.secretarias(id, usuario_id), check (hora_fim is null or hora_fim > hora_inicio)
);
alter table public.visitas add constraint visitas_medico_proprietario unique (id, medico_id, usuario_id);
alter table public.visitas enable row level security;
revoke all on public.visitas from anon, authenticated;
grant select, insert, update on public.visitas to authenticated;
create policy registros_proprios on public.visitas for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index visitas_usuario_atualizacao on public.visitas(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.visitas
  for each row execute function public.controlar_versao();

create table public.visita_produtos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  visita_id uuid not null, produto_id uuid not null, quantidade_amostras integer not null default 0 check (quantidade_amostras >= 0), observacoes text, foreign key (visita_id, usuario_id) references public.visitas(id, usuario_id), foreign key (produto_id, usuario_id) references public.produtos(id, usuario_id), unique (usuario_id, visita_id, produto_id)
);
alter table public.visita_produtos enable row level security;
revoke all on public.visita_produtos from anon, authenticated;
grant select, insert, update on public.visita_produtos to authenticated;
create policy registros_proprios on public.visita_produtos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index visita_produtos_usuario_atualizacao on public.visita_produtos(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.visita_produtos
  for each row execute function public.controlar_versao();

create table public.formularios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  medico_id uuid not null, visita_id uuid not null, status text not null default 'rascunho' check (status in ('rascunho','finalizado')), dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'), foreign key (medico_id, usuario_id) references public.medicos(id, usuario_id), foreign key (visita_id, medico_id, usuario_id) references public.visitas(id, medico_id, usuario_id)
);
alter table public.formularios enable row level security;
revoke all on public.formularios from anon, authenticated;
grant select, insert, update on public.formularios to authenticated;
create policy registros_proprios on public.formularios for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index formularios_usuario_atualizacao on public.formularios(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.formularios
  for each row execute function public.controlar_versao();

create table public.historico_reagendamentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  visita_id uuid not null, data_anterior date not null, hora_anterior time not null, data_nova date not null, hora_nova time not null, alterado_em timestamptz not null default now(), foreign key (visita_id, usuario_id) references public.visitas(id, usuario_id)
);
alter table public.historico_reagendamentos enable row level security;
revoke all on public.historico_reagendamentos from anon, authenticated;
grant select, insert, update on public.historico_reagendamentos to authenticated;
create policy registros_proprios on public.historico_reagendamentos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index historico_reagendamentos_usuario_atualizacao on public.historico_reagendamentos(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.historico_reagendamentos
  for each row execute function public.controlar_versao();

create table public.eventos_google (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  visita_id uuid not null, evento_id text, calendario_id text, status text not null default 'pendente' check (status in ('pendente','sincronizado','erro')), ultimo_erro text, foreign key (visita_id, usuario_id) references public.visitas(id, usuario_id), unique (usuario_id, visita_id)
);
alter table public.eventos_google enable row level security;
revoke all on public.eventos_google from anon, authenticated;
grant select, insert, update on public.eventos_google to authenticated;
create policy registros_proprios on public.eventos_google for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index eventos_google_usuario_atualizacao on public.eventos_google(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.eventos_google
  for each row execute function public.controlar_versao();

create table public.secretaria_medicos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  versao bigint not null default 1 check (versao > 0),
  unique (id, usuario_id),
  secretaria_id uuid not null, medico_id uuid not null, foreign key (secretaria_id, usuario_id) references public.secretarias(id, usuario_id), foreign key (medico_id, usuario_id) references public.medicos(id, usuario_id), unique (usuario_id, secretaria_id, medico_id)
);
alter table public.secretaria_medicos enable row level security;
revoke all on public.secretaria_medicos from anon, authenticated;
grant select, insert, update on public.secretaria_medicos to authenticated;
create policy registros_proprios on public.secretaria_medicos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create index secretaria_medicos_usuario_atualizacao on public.secretaria_medicos(usuario_id, atualizado_em, id);
create trigger controlar_versao before update on public.secretaria_medicos
  for each row execute function public.controlar_versao();

create unique index medicos_crm_uf_unico on public.medicos
  (usuario_id, lower(trim(crm)), upper(trim(uf_crm)))
  where excluido_em is null and nullif(trim(crm), '') is not null and nullif(trim(uf_crm), '') is not null;

create function public.preservar_finalizado() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'finalizado' then new.status := 'finalizado'; end if;
  return new;
end;
$$;
create trigger preservar_finalizado before update on public.formularios
  for each row execute function public.preservar_finalizado();

-- Finalização atômica remota futura. O cliente envia as versões lidas anteriormente.
create function public.finalizar_formulario(formulario uuid, versao_formulario bigint, versao_visita bigint)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  registro public.formularios;
  compromisso public.visitas;
begin
  select * into registro from public.formularios where id = formulario and usuario_id = auth.uid() for update;
  if not found then raise exception 'Formulário não encontrado'; end if;
  select * into compromisso from public.visitas where id = registro.visita_id and usuario_id = auth.uid() for update;
  if not found then raise exception 'Visita não encontrada'; end if;
  if compromisso.status = 'cancelada' then raise exception 'Visita cancelada'; end if;
  if registro.versao <> versao_formulario or compromisso.versao <> versao_visita then
    raise exception 'Conflito de versão' using errcode = '40001';
  end if;
  update public.formularios set status = 'finalizado' where id = registro.id;
  update public.visitas set status = 'realizada' where id = compromisso.id;
end;
$$;
revoke execute on function public.finalizar_formulario(uuid,bigint,bigint) from public, anon;
grant execute on function public.finalizar_formulario(uuid,bigint,bigint) to authenticated;
commit;
