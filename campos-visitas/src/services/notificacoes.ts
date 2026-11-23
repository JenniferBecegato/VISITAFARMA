import { supabase } from './supabase';

export const chavePublicaPush = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
export function suportaNotificacoes() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
async function aguardar<T>(operacao: PromiseLike<T>, mensagem: string, prazo = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operacao,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(mensagem)), prazo); })]);
  } finally { clearTimeout(timer); }
}
export async function workerPronto() {
  return aguardar(navigator.serviceWorker.ready,
    'Atualize o app e tente novamente para ativar as notificações.', 10000);
}
function chaveAplicacao(chave: string) {
  const bytes = atob(chave.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(chave.length / 4) * 4, '='));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
export async function ativarNotificacoes(usuarioId: string) {
  if (!supabase || !chavePublicaPush) throw new Error('Os lembretes no celular ainda precisam ser configurados no servidor.');
  if (!suportaNotificacoes()) throw new Error('Instale o app na tela inicial e abra por seu ícone para ativar os avisos.');
  // O pedido precisa ser iniciado diretamente pelo toque do usuário, inclusive no iPhone.
  const permissao = await aguardar(Notification.requestPermission(),
    'A permissão ficou pendente. Responda ao aviso do navegador ou confira as permissões do app e tente novamente.', 30000);
  if (permissao !== 'granted') throw new Error('Permita notificações nas configurações do celular para receber os lembretes.');
  const registro = await workerPronto();
  let assinatura = await aguardar(registro.pushManager.getSubscription(), 'O navegador não respondeu ao consultar as notificações. Tente novamente.');
  if (!assinatura) assinatura = await aguardar(registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveAplicacao(chavePublicaPush) }),
    'O serviço de notificações não respondeu. Confira a conexão e tente novamente.');
  const json = assinatura.toJSON();
  const { error } = await aguardar(supabase.rpc('registrar_push', { endereco: json.endpoint, chave_p256dh: json.keys?.p256dh, chave_auth: json.keys?.auth }),
    'O servidor não confirmou a ativação. Confira a conexão e tente novamente.');
  if (error) throw new Error('Não foi possível ativar os avisos. Verifique a conexão e a configuração do servidor.');
  localStorage.setItem('campos-push-usuario', usuarioId);
  registro.active?.postMessage({ tipo: 'CONTA_PUSH', usuarioId });
}
export async function desativarNotificacoes() {
  if ('serviceWorker' in navigator) {
    const mensagem = 'O navegador não confirmou a desativação dos avisos. Tente novamente.';
    const registro = await aguardar(navigator.serviceWorker.getRegistration(), mensagem);
    const assinatura = registro ? await aguardar(registro.pushManager.getSubscription(), mensagem) : null;
    if (assinatura && !await aguardar(assinatura.unsubscribe(), mensagem)) throw new Error('Não foi possível desativar os avisos. Tente novamente.');
    registro?.active?.postMessage({ tipo: 'SAIR_PUSH' });
  }
  localStorage.removeItem('campos-push-usuario');
  void atualizarSelo([], '');
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
