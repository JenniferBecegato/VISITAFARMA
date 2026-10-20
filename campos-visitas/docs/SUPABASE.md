# Supabase — configuração atual

As migrações `202610150001_base.sql` e `202610190001_sincronizacao.sql` foram aplicadas ao projeto TesteAgendaProject em 19/10/2026, após confirmar que o esquema public estava vazio.

A verificação de `supabase/verificar_sincronizacao.sql` também passou no Supabase hospedado: envio, reenvio idempotente, conflitos, finalização atômica, RLS e isolamento entre contas. Os registros fictícios foram revertidos ao final da transação. Evidência em `docs/supabase-validacao.png`.

A configuração do app está em `.env.local`; `.env.example` contém somente exemplos. Não repetir as migrações iniciais neste projeto.

O aplicativo agora possui login por e-mail/senha, perfil por conta, fila local atômica, sincronização bidirecional e resolução de conflitos. Consulte `docs/SINCRONIZACAO.md` para funcionamento, configuração em um projeto novo e limites desta etapa.

Para começar a usar, criar as contas reais em Authentication > Users e fazer o primeiro login com internet. As senhas devem ser definidas pela usuária/administradora, fora do chat. O login de Jennifer foi conferido no navegador; a conferência em celular/tablet depende dos dispositivos.

O banco local mantém os dados de teste separados das contas reais. A atualização do IndexedDB guarda um snapshot desses dados e oferece download após o login; eles não são enviados ao Supabase.

## Perfil cadastral — 19/10/2026

A migração `202610190002_perfil_usuario.sql` foi aplicada: nome e unidade são obrigatórios, o aplicativo só consulta o próprio perfil e o cadastro administrativo cria o perfil junto da conta Auth. Jennifer permanece cadastrada como Jennifer, unidade Washington Luiz. A tela de entrada possui somente login (e-mail) e senha.
