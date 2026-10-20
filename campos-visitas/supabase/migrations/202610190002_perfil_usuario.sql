-- Aplicar após 202610190001_sincronizacao.sql.
-- Nome e unidade são dados cadastrais; o login apenas os consulta.
begin;
alter table public.usuarios alter column unidade set not null;
alter table public.usuarios add constraint usuarios_nome_valido
  check (length(trim(nome)) between 1 and 80);
revoke insert, update on public.usuarios from authenticated;
drop policy usuario_proprio on public.usuarios;
create policy usuario_proprio_leitura on public.usuarios for select to authenticated
  using (id = (select auth.uid()));

-- O script administrativo envia nome/unidade nos metadados ao criar a conta.
-- O perfil nasce na mesma transação; não são usadas senhas na tabela pública.
create function public.criar_perfil_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nome_usuario text; unidade_usuario text;
begin
  nome_usuario := trim(new.raw_user_meta_data->>'nome');
  unidade_usuario := new.raw_user_meta_data->>'unidade';
  if nome_usuario is null or nome_usuario = '' or unidade_usuario is null then
    return new; -- Contas criadas por outros fluxos precisam de cadastro administrativo.
  end if;
  insert into public.usuarios(id, nome, unidade) values(new.id, nome_usuario, unidade_usuario);
  return new;
end;
$$;
revoke all on function public.criar_perfil_usuario() from public, anon, authenticated;
create trigger criar_perfil_usuario after insert on auth.users
  for each row execute function public.criar_perfil_usuario();
commit;
