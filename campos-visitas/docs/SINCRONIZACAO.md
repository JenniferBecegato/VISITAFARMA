# Login e sincronização

O aplicativo usa IndexedDB (Dexie) no aparelho e Supabase no servidor. Toda gravação de negócio gera uma pendência na mesma transação IndexedDB. Dados antigos de teste permanecem separados; a atualização para a versão 3 guarda também um snapshot em `backupsLegados`, disponível para download após entrar.

## Preparação do projeto vazio

1. Preencher `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O `.env.example` contém somente os nomes das variáveis. Reiniciar o Vite após mudar a configuração.
2. Aplicar, em ordem, `supabase/migrations/202610150001_base.sql` , `supabase/migrations/202610190001_sincronizacao.sql` e `supabase/migrations/202610190002_perfil_usuario.sql` no SQL Editor. São migrações para aplicar uma única vez; não repetir em banco já preparado.
3. Criar as contas com o script administrativo, informando também nome e unidade nos metadados. O banco cria o perfil na mesma transação. Contas criadas por outros fluxos precisam ter o cadastro preenchido em public.usuarios pela administração. O aplicativo não oferece cadastro público.
4. Entrar somente com e-mail e senha. Nome e unidade são obrigatórios na tabela public.usuarios, consultados pelo aplicativo e mantidos pela administração; não são preenchidos na tela de login. Cadastros incompletos bloqueiam a entrada com uma mensagem explicativa.

## Uso

- O primeiro acesso exige internet. A conta previamente autenticada pode reabrir o aplicativo offline e trabalhar com os dados já presentes no aparelho. Um aparelho novo precisa concluir a primeira sincronização para receber os dados anteriores.
- As contas têm dados separados. Para usar os mesmos registros no celular e tablet, entrar com a mesma conta.
- A sincronização ocorre ao abrir/entrar, recuperar conexão, voltar à tela, após gravar e a cada 60 segundos com o app visível. O botão permite tentar imediatamente.
- Falhas de rede/servidor preservam a fila; novas tentativas usam intervalos de 5 segundos até cinco minutos. O indicador do navegador não substitui a tentativa real de conexão.
- Ao sair, o acesso local é fechado e as pendências são mantidas para o próximo login da mesma conta. Sessão rejeitada pelo servidor exige novo login. As alterações já gravadas ficam no aparelho.
- Conflitos exibem as diferenças e exigem escolher uma versão. O lote aguarda a resolução para não confirmar somente parte de uma operação relacionada.
- Fechar o APK interrompe a sincronização nesta etapa; a próxima abertura retoma o trabalho. A execução em segundo plano no Android não está implementada.

## Contrato e limites

`sincronizar_lote(lote jsonb)` verifica versões antes de gravar, preserva UUIDs e registra a revisão do cliente para reenvio idempotente. Um lote reúne as pendências da conta (até 5.000 registros), em ordem de dependências. Formulário finalizado exige visita realizada na mesma transação. Vínculos de secretárias são espelhados na tabela relacional.

`baixar_snapshot()` devolve uma visão transacional completa da conta, incluindo exclusões lógicas. Para esta base pequena, a conferência baixa o snapshot inteiro e aplica somente versões novas. Uma base muito maior exigirá paginação consistente ou cursor remoto antes de aumentar os limites.

Metadados e fila locais ficam separados dos registros de negócio; revisões diferentes preservam edições feitas durante o envio. Downloads não substituem registros com pendências. Não há importação dos testes antigos, integração com Google Agenda nem restauração geral de backup nesta entrega.

## Verificações

`npm test`, `npm run lint` e `npm run build`. Os testes novos usam IndexedDB de teste e PostgreSQL local (PGlite), com duas contas, políticas RLS, vínculos, finalização atômica, repetição de envio, rollback e conflitos. Esses testes não substituem a conferência final no Supabase hospedado e nos aparelhos.

## Cadastro administrativo de contas

O script `node scripts/criar-usuario.mjs` usa a chave privada em `.env.admin.local`. Configure `SUPABASE_NEW_USER_EMAIL`, `SUPABASE_NEW_USER_NAME`, `SUPABASE_NEW_USER_UNIT` (Dr. Gurgel ou Washington Luiz) e `SUPABASE_NEW_USER_PASSWORD`. Nome e unidade são enviados nos metadados de criação e persistidos pelo trigger no cadastro público. A chave administrativa nunca é incluída no aplicativo. O login comum tem apenas permissão de leitura do próprio perfil.
