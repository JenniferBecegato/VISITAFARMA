import { supabase } from './supabase';

export const chavePublicaPush = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
export function suportaNotificacoes() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export async function workerPronto() {
  return Promise.race([navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Atualize o app e tente novamente para ativar as notificações.')), 10000))]);
}
function chaveAplicacao(chave: string) {
  const bytes = atob(chave.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(chave.length / 4) * 4, '='));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
export async function ativarNotificacoes(usuarioId: string) {
  if (!supabase || !chavePublicaPush) throw new Error('Os lembretes no celular ainda precisam ser configurados no servidor.');
  if (!suportaNotificacoes()) throw new Error('Instale o app na tela inicial e abra por seu ícone para ativar os avisos.');
  // O pedido precisa ser iniciado diretamente pelo toque do usuário, inclusive no iPhone.
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permita notificações nas configurações do celular para receber os lembretes.');
  const registro = await workerPronto();
  let assinatura = await registro.pushManager.getSubscription();
  if (!assinatura) assinatura = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveAplicacao(chavePublicaPush) });
  const json = assinatura.toJSON();
  const { error } = await supabase.rpc('registrar_push', { endereco: json.endpoint, chave_p256dh: json.keys?.p256dh, chave_auth: json.keys?.auth });
  if (error) throw new Error('Não foi possível ativar os avisos. Verifique a conexão e a configuração do servidor.');
  localStorage.setItem('campos-push-usuario', usuarioId);
  registro.active?.postMessage({ tipo: 'CONTA_PUSH', usuarioId });
}
export async function desativarNotificacoes() {
  if ('serviceWorker' in navigator) {
    const registro = await navigator.serviceWorker.getRegistration();
    const assinatura = await registro?.pushManager.getSubscription();
    if (assinatura && !await assinatura.unsubscribe()) throw new Error('Não foi possível desativar os avisos. Tente novamente.');
    registro?.active?.postMessage({ tipo: 'SAIR_PUSH' });
  }
  localStorage.removeItem('campos-push-usuario');
  await atualizarSelo([], '');
}
export async function atualizarSelo(chaves: string[], usuarioId: string, lidas: string[] = []) {
  const badge = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (chaves.length) await badge.setAppBadge?.(chaves.length);
    else await badge.clearAppBadge?.();
    const registro = await navigator.serviceWorker?.getRegistration();
    registro?.active?.postMessage({ tipo: 'LEMBRETES_LIDOS', chaves, usuarioId, lidas });
    const notificacoes = await registro?.getNotifications();
    for (const aviso of notificacoes ?? []) {
      if (aviso.data?.tipo === 'lembrete' && (aviso.data.usuarioId !== usuarioId || !chaves.includes(aviso.data.chave))) aviso.close();
    }
  } catch { /* O indicador dentro do app funciona mesmo sem suporte ao selo. */ }
}
