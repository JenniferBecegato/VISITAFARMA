// Gera as chaves localmente. O arquivo privado é ignorado pelo Git e nunca vai para dist/.
import { createECDH, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

const arquivo = nome => fileURLToPath(new URL(`../${nome}`, import.meta.url));
loadEnvFile(arquivo('.env.local'));
const url = new URL(process.env.VITE_SUPABASE_URL);
if (url.protocol !== 'https:') throw new Error('Configure uma URL HTTPS válida para o projeto Supabase.');
if (!existsSync(arquivo('.env.push.local'))) {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  writeFileSync(arquivo('.env.push.local'), [
    `WEB_PUSH_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`,
    `WEB_PUSH_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`,
    `WEB_PUSH_SUBJECT=${url.origin}`,
    `LEMBRETES_JOB_SECRET=${randomBytes(32).toString('hex')}`,
    ''
  ].join('\n'), { mode: 0o600 });
}
loadEnvFile(arquivo('.env.push.local'));
let frontend = readFileSync(arquivo('.env.local'), 'utf8');
const linha = `VITE_WEB_PUSH_PUBLIC_KEY=${process.env.WEB_PUSH_PUBLIC_KEY}`;
frontend = /^VITE_WEB_PUSH_PUBLIC_KEY=.*$/m.test(frontend)
  ? frontend.replace(/^VITE_WEB_PUSH_PUBLIC_KEY=.*$/m, linha) : `${frontend.trimEnd()}\n${linha}\n`;
writeFileSync(arquivo('.env.local'), frontend);
const cron = `-- Executar somente depois de publicar enviar-lembretes e criar o segredo no Vault.
-- Vault: nome lembretes_job_secret, valor LEMBRETES_JOB_SECRET de .env.push.local.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'campos-visitas-lembretes',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := '${url.origin}/functions/v1/enviar-lembretes',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-lembretes-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembretes_job_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
`;
writeFileSync(arquivo('supabase/agendar-lembretes.sql'), cron);
console.log('Configuração local preparada. Chaves privadas preservadas em .env.push.local. Nenhum serviço remoto foi alterado.');
