import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';

// Publicação com verify_jwt=false: o Cron autentica por um segredo exclusivo no cabeçalho.
Deno.serve(async (pedido: Request) => {
  const segredo = Deno.env.get('LEMBRETES_JOB_SECRET');
  if (pedido.method !== 'POST' || !segredo || pedido.headers.get('x-lembretes-secret') !== segredo) {
    return new Response('Não autorizado', { status: 401 });
  }
  const cliente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    webpush.setVapidDetails(Deno.env.get('WEB_PUSH_SUBJECT')!, Deno.env.get('WEB_PUSH_PUBLIC_KEY')!, Deno.env.get('WEB_PUSH_PRIVATE_KEY')!);
    const { data: envios, error } = await cliente.rpc('reservar_lembretes_push');
    if (error) throw error;
    let enviados = 0; let falhas = 0;
    // Sequencial para respeitar limites e a ordem de entrega por aparelho.
    for (const envio of envios ?? []) {
      try {
        const url = new URL(envio.endpoint);
        const permitido = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']
          .some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
        if (url.protocol !== 'https:' || url.port || !permitido) throw new Error('Endpoint inválido');
        // Uma leitura feita após a reserva também impede o envio.
        const leitura = await cliente.from('lembretes_lidos').select('chave').eq('usuario_id', envio.usuario_id).eq('chave', envio.chave).maybeSingle();
        if (leitura.error) throw leitura.error;
        if (!leitura.data && envio.ttl > 0) {
          await webpush.sendNotification({ endpoint: envio.endpoint, keys: { p256dh: envio.p256dh, auth: envio.auth } }, JSON.stringify({
            tipo: 'lembrete', usuarioId: envio.usuario_id, chave: envio.chave, data: envio.data,
            hora: envio.hora_inicio.slice(0, 5), total: Number(envio.total),
            titulo: 'Lembrete de visita', corpo: `Você tem uma visita em ${envio.data.split('-').reverse().join('/')} às ${envio.hora_inicio.slice(0, 5)}. Abra o app para conferir.`,
            expiraEm: new Date(`${envio.data}T23:59:59-03:00`).getTime()
          }), { TTL: envio.ttl, urgency: 'normal', timeout: 10000 });
          enviados++;
        }
        const resultado = await cliente.from('push_envios').update({ enviado_em: new Date().toISOString() }).eq('id', envio.envio_id);
        if (resultado.error) throw resultado.error;
      } catch (erro) {
        const status = (erro as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await cliente.from('push_dispositivos').delete().eq('id', envio.dispositivo_id);
        } else falhas++;
        // Não registrar endpoints, chaves, payloads ou dados pessoais nos logs.
        console.error('Falha no envio de lembrete', { status: status ?? 500 });
      }
    }
    return Response.json({ enviados, falhas }, { status: falhas ? 207 : 200 });
  } catch {
    console.error('Não foi possível executar o serviço de lembretes');
    return new Response('Falha ao processar lembretes', { status: 500 });
  }
});
