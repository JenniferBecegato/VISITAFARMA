-- Executar somente depois de publicar enviar-lembretes e criar o segredo no Vault.
-- Vault: nome lembretes_job_secret, valor LEMBRETES_JOB_SECRET de .env.push.local.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'campos-visitas-lembretes',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://clfukutapxiumehzsumy.supabase.co/functions/v1/enviar-lembretes',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-lembretes-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembretes_job_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
