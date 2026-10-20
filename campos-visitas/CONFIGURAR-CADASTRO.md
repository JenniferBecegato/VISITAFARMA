# Cadastro e acesso com Google

O app permite cadastro por e-mail/senha e autenticação Google pelo Supabase. Não armazena senhas no banco público ou no histórico local de sugestões.

## Configuração do projeto Supabase

1. Aplicar `supabase/migrations/202610200002_autocadastro.sql` no SQL Editor, depois das migrações existentes. A função permite que uma pessoa autenticada complete apenas o próprio perfil ausente; não modifica perfis existentes.
2. Em Authentication, habilitar novos cadastros e o provedor Email. Quando a confirmação de e-mail estiver habilitada, o usuário deverá confirmar o endereço antes de entrar.
3. Configurar um cliente OAuth Web no Google Cloud e autorizar a URL de callback mostrada pelo Supabase em Authentication > Sign In / Providers > Google. Informar Client ID e Client Secret nesse painel do Supabase. Não colocar o segredo no frontend.
4. Em Authentication > URL Configuration, configurar Site URL e autorizar as URLs exatas do aplicativo, incluindo o endereço local usado nos testes. O app retorna para a origem e caminho atuais.
5. Se o aplicativo Google estiver em teste, adicionar os usuários de teste ou concluir a publicação no Google Cloud.

Documentação: https://supabase.com/docs/guides/auth/social-login/auth-google

## Sugestões de e-mail

Após um login concluído, o endereço autenticado é guardado neste navegador (até dez endereços). Ao digitar um prefixo no login, o campo oferece os endereços correspondentes. Sair da conta preserva as sugestões. Limpar os dados do navegador remove o histórico. Endereços cadastrados em outros dispositivos não aparecem automaticamente: não há consulta pública à lista de usuários do banco.

## Validação manual após configurar o servidor

- Cadastrar nome, unidade, e-mail e senha; confirmar o e-mail quando solicitado e entrar.
- Sair, começar a digitar o e-mail e selecionar a sugestão.
- Usar Cadastrar com Google; no primeiro acesso, completar nome e unidade. Sair e entrar novamente usando Continuar com Google.
- Cancelar o fluxo Google e tentar novamente; confirmar que contas existentes preservam nome e unidade.

As configurações remotas e a migração precisam ser aplicadas no projeto Supabase; a compilação local não as habilita.
