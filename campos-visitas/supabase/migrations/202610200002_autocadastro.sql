-- Permite completar apenas o próprio perfil ausente, inclusive após OAuth Google.
begin;
create function public.completar_cadastro(nome_informado text, unidade_informada text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if nome_informado is null or length(trim(nome_informado)) not between 1 and 80
    or unidade_informada is null or unidade_informada not in ('Dr. Gurgel', 'Washington Luiz') then
    raise exception 'Nome ou unidade inválidos';
  end if;
  insert into public.usuarios(id, nome, unidade)
    values(auth.uid(), trim(nome_informado), unidade_informada)
    on conflict(id) do nothing;
end;
$$;
revoke all on function public.completar_cadastro(text,text) from public, anon;
grant execute on function public.completar_cadastro(text,text) to authenticated;
commit;
