import { App } from '@capacitor/app';
import type { SupabaseClient } from '@supabase/supabase-js';

export const RETORNO_ANDROID = 'com.campos.visitas://auth/callback';
const codigosRecebidos = new Set<string>();

export function escutarRetornoAndroid(cliente: SupabaseClient, informarErro: (mensagem: string) => void) {
  let ativo = true;

  async function receber(endereco: string) {
    if (!ativo) return;
    const url = new URL(endereco);
    if (`${url.protocol}//${url.host}${url.pathname}` !== RETORNO_ANDROID) return;

    const codigo = url.searchParams.get('code');
    if (!codigo) {
      informarErro('O login não foi concluído. Tente novamente.');
      return;
    }
    if (codigosRecebidos.has(codigo)) return;
    codigosRecebidos.add(codigo);

    const { error } = await cliente.auth.exchangeCodeForSession(codigo);
    if (ativo && error) informarErro('Não foi possível concluir o login. Inicie o acesso novamente.');
  }

  function falha() {
    if (ativo) informarErro('Não foi possível processar o retorno ao aplicativo. Tente novamente.');
  }

  const listener = App.addListener('appUrlOpen', ({ url }) => { void receber(url).catch(falha); });
  void listener.then(async () => {
    const abertura = await App.getLaunchUrl();
    if (abertura) await receber(abertura.url);
  }).catch(falha);

  return () => {
    ativo = false;
    void listener.then(handle => handle.remove()).catch(falha);
  };
}
