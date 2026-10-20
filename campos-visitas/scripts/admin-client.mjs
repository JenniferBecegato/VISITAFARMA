import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export function criarClienteAdmin() {
  for (const arquivo of ['../.env.local', '../.env.admin.local']) {
    try { loadEnvFile(fileURLToPath(new URL(arquivo, import.meta.url))); }
    catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || chave.startsWith('sb_publishable_')) {
    throw new Error('Configure a URL em .env.local e a chave administrativa em .env.admin.local.');
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) }
  });
}
