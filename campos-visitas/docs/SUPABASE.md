# Preparação do Supabase

Situação: arquivos preparados localmente; nenhum serviço ou conta foi criado e nenhuma migração foi aplicada. O aplicativo continua no modo local de teste, sem autenticação ou sincronização remota.

1. Criar um projeto no Supabase e manter a senha do banco em local privado.
2. Configurar Supabase Auth para as contas de Adriana e Patrícia. A entrada inicial exige internet.
3. Aplicar `supabase/migrations/202610150001_base.sql` em um projeto novo usando o SQL Editor ou as migrações da CLI. O script é uma migração inicial, para aplicar uma única vez. Não executar em banco existente sem revisar conflitos.
4. Copiar `.env.example` para `.env.local` e preencher URL e chave publishable do projeto. Nunca usar secret/service_role no navegador.
5. Antes de conectar o aplicativo, implementar o cliente Supabase Auth, o bloqueio local de sessão e a substituição de `usuario-local-teste` pelo identificador autenticado. Migrar os dados de teste só após confirmar sua proprietária e exportar um backup.
6. Implementar o adaptador dos nomes camelCase locais para snake_case remoto. As respostas do formulário vão em `formularios.dados`; os vínculos de secretárias usam `secretaria_medicos`. A fila de sincronização fica no IndexedDB; não é uma tabela de negócio remota.
7. Implementar fila persistente, reenvio idempotente por UUID e sincronização bidirecional. Para atualizar, enviar a `versao` recebida na última leitura. O gatilho rejeita versões divergentes e incrementa a versão confirmada. Não baixar dados por cima de alterações locais pendentes. Guardar a versão-base local e apresentar conflitos para resolução, sem substituição silenciosa.
8. Testar com duas contas: cada usuária deve conseguir ler e alterar apenas os próprios registros. Testar FKs com IDs pertencentes à outra usuária, tentativas sem login e gravações concorrentes em celular/tablet. A política de RLS protege os registros e as chaves estrangeiras compostas protegem os vínculos.
9. Validar a migração com PostgreSQL/Supabase real antes de produção. O script ainda não foi executado neste ambiente. A RPC de finalização atualiza formulário e visita na mesma transação; o serviço de sincronização deverá tratar a finalização como operação conjunta e validar as respostas obrigatórias antes de chamá-la.

O SQL inclui médicos, secretárias, produtos, visitas, formulários, produtos por visita, vínculos de secretárias, histórico de reagendamentos, eventos Google e perfil da usuária. A integração Google deverá guardar tokens somente no servidor, em estrutura privada com acesso restrito, ainda não implementada.

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [chaves de API](https://supabase.com/docs/guides/getting-started/api-keys).
