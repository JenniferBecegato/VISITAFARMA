# Lembretes de visitas no celular

## Comportamento

- Android e iPhone: aviso às 8h do dia anterior, no fuso America/Sao_Paulo. O serviço verifica a fila a cada cinco minutos, a partir das 8h. O sistema operacional e a conexão podem atrasar a entrega.
- Apenas visitas agendadas/reagendadas, sem exclusão lógica. O cadastro precisa estar sincronizado no Supabase para gerar push com o app fechado.
- A página inicial mostra os eventos com a bolinha rosa. Tocar nela marca o lembrete como lido, retira o lembrete dessa lista, fecha a notificação correspondente neste aparelho e recalcula o selo do ícone. O evento continua cadastrado na agenda. Quando não há pendências, o quadro mostra somente o título Lembretes de visitas.
- Cada leitura se refere a visita + data + horário. Reagendar para outra data ou horário pode gerar um novo aviso.
- Lembretes não lidos continuam visíveis no dia da visita. O contador representa os lembretes não lidos de hoje e de amanhã já liberados às 8h. Ao abrir o app após o dia do evento, ele deixa de entrar na contagem.
- Leituras funcionam offline: ficam no IndexedDB e são enviadas ao servidor ao reconectar. Enquanto a leitura não chegar ao servidor, outro aparelho ainda pode receber o aviso. A leitura em outro aparelho é recebida ao abrir/atualizar o app; não há push silencioso para apagar selos de aparelhos fechados.
- Cada visita produz uma notificação, evitando que a bolinha rosa de uma visita apague as notificações das demais. Tags estáveis impedem duplicação visual em um reenvio.
- Sair pelo botão Alterar identificação desativa a assinatura neste aparelho e limpa os avisos locais. É preciso ativá-los novamente após entrar.

## O que já foi preparado localmente

Código do app, service worker de push, migração SQL, função Supabase `enviar-lembretes`, SQL de agendamento e chaves VAPID.

O script `node scripts/preparar-notificacoes.mjs` já foi executado. Ele criou `.env.push.local` com as chaves privadas e o segredo do agendamento; também adicionou somente a chave pública a `.env.local`. Esses arquivos privados são ignorados pelo Git e não fazem parte do pacote de entrega. Não recriar nem trocar as chaves depois de cadastrar aparelhos sem planejar a renovação das assinaturas.

Nenhum recurso remoto foi publicado ou ativado nesta etapa. Apenas executar o SQL de tabelas não inicia o envio em segundo plano.

## Ativação no Supabase

1. No SQL Editor do projeto existente, executar `supabase/migrations/202610200003_notificacoes.sql`. As migrações anteriores precisam estar aplicadas; não repetir as migrações iniciais do projeto existente.
2. Com o Supabase CLI oficial instalado e autenticado, executar na pasta `campos-visitas`:

   ```powershell
   supabase secrets set --env-file .env.push.local --project-ref SEU_PROJECT_REF
   supabase functions deploy enviar-lembretes --project-ref SEU_PROJECT_REF
   ```

   `SEU_PROJECT_REF` é o identificador do projeto que aparece no painel do Supabase. A configuração em `supabase/config.toml` desabilita o verificador JWT somente para essa função: ela exige um segredo próprio no cabeçalho `x-lembretes-secret`, conferido antes de acessar o banco. Não publicar sem os secrets.

3. Em Supabase Vault, criar o segredo chamado `lembretes_job_secret`, com o valor de `LEMBRETES_JOB_SECRET` do arquivo privado `.env.push.local`. Não copiar a chave VAPID privada para o frontend, para o SQL público ou para mensagens.
4. Ativar as extensões Cron/pg_cron e pg_net, se necessário. Executar `supabase/agendar-lembretes.sql` no SQL Editor. O SQL já contém a URL pública deste projeto e lê o segredo pelo Vault. O job chama a função a cada cinco minutos. Executar novamente com o mesmo nome atualiza o agendamento.
5. Publicar o conteúdo atualizado de `dist` no endereço HTTPS usado pelo app. A chave pública precisa estar presente durante a compilação. Após alterar `.env.local`, reiniciar o Vite ou executar `npm run build` novamente.
6. Abrir o app instalado, entrar e ligar a chave Notificações no canto superior direito da página inicial. Aceitar o pedido do sistema em cada aparelho.

Se o projeto for outro, configurar `.env.local` e executar novamente o script de preparação para atualizar o endereço do agendamento; manter o mesmo par de chaves quando as assinaturas existentes precisarem continuar válidas.

## Android e iPhone

- iPhone/iPad: requer iOS/iPadOS 16.4 ou posterior, app adicionado à Tela de Início e permissão para notificações e selos. O pedido deve partir de um toque no botão do app.
- Android: a notificação aparece conforme as permissões do navegador/app e do sistema. O selo no ícone é controlado pelo Android e pelo launcher; pode ser uma bolinha, um número relacionado às notificações ou não aparecer. O PWA não consegue impor um contador numérico exato em todos os aparelhos Android.
- O contador dentro do app é sempre calculado pelo aplicativo. Os métodos setAppBadge/clearAppBadge são usados somente quando disponíveis. Modos Foco/Não Perturbe, economia de bateria, ausência de internet e permissões negadas podem atrasar ou impedir avisos.

## Validação

Verificados localmente: compilação, lint, testes do calendário de lembretes e das regras SQL em PostgreSQL/PGlite, isolamento por conta, fila/reenvio, leitura idempotente e service worker com notificações e selo simulados. A interface foi conferida em largura de celular com dois eventos fictícios; tocar nas bolinhas reduz a quantidade de dois para um e depois zero.

Após publicar, conferir em Android e iPhone reais:

1. Instalar/atualizar o PWA e permitir notificações.
2. Agendar duas visitas para amanhã e sincronizar antes das 8h. Fechar o app.
3. Verificar os dois avisos e o selo disponível no aparelho após a execução das 8h.
4. Abrir um aviso: a página inicial deve aparecer, ainda com as bolinhas. Ler uma bolinha e depois a outra; os eventos devem permanecer e os avisos desaparecer, com contador zerado.
5. Repetir com leitura offline e reconexão, cancelamento e reagendamento. Cancelamentos feitos offline só são conhecidos pelo servidor após sincronizar.
6. Conferir Cron > Run history e logs da função. A fila tenta novamente após cinco minutos, no máximo cinco tentativas; endpoints revogados (404/410) são removidos.

Não foi realizado envio real nem teste físico em celular nesta etapa. O runtime Deno da função será validado na publicação; o serviço de push do navegador precisa confirmar a entrega real.

Fontes: [Supabase: agendar funções](https://supabase.com/docs/guides/functions/schedule-functions), [Apple: Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [MDN: selo do ícone](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon).
