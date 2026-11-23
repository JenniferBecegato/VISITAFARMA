import { useEffect, useState } from 'react';
import { useConta } from '../services/conta';
import { supabase } from '../services/supabase';
import {
  autorizarGoogleAgenda, criarEventoGoogle, listarAgendasGoogle, listarEventosGoogle, ErroGoogleAgenda, PermissaoGoogleAgenda, type AgendaGoogle,
} from '../services/googleAgenda';
import type { Visita } from '../database/database';

type Eventos = Awaited<ReturnType<typeof listarEventosGoogle>>;

export function useGoogleAgenda(mes: string) {
  const { usuarioId, email } = useConta();
  const chave = `campos-google-agenda:${usuarioId}`;
  const [agendaPreferida, setAgendaPreferida] = useState(() => localStorage.getItem(chave));
  const [token, setToken] = useState<string>();
  const [agendas, setAgendas] = useState<{ token: string; itens: AgendaGoogle[] }>();
  const [eventos, setEventos] = useState<{ token: string; agenda: string; mes: string; dias: Eventos }>();
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [autorizando, setAutorizando] = useState(false);
  const opcoes = agendas?.token === token ? agendas?.itens : undefined;
  const agenda = agendaPreferida === null
    ? opcoes?.find(item => item.primary)?.id ?? opcoes?.[0]?.id ?? ''
    : opcoes?.find(item => item.id === agendaPreferida)?.id ?? '';
  const papel = opcoes?.find(item => item.id === agenda)?.accessRole;
  const podeCriar = papel === 'owner' || papel === 'writer';

  useEffect(() => {
    if (agendaPreferida === null && podeCriar) localStorage.setItem(chave, agenda);
  }, [agenda, agendaPreferida, chave, podeCriar]);

  useEffect(() => {
    let ultimoToken: string | undefined;
    const assinatura = supabase?.auth.onAuthStateChange((evento, sessao) => {
      if (sessao?.user.id !== usuarioId || evento === 'SIGNED_OUT') {
        ultimoToken = undefined;
        setToken(undefined);
      } else if (sessao.provider_token && sessao.provider_token !== ultimoToken) {
        ultimoToken = sessao.provider_token;
        setToken(ultimoToken);
        setErro('');
      }
    });
    return () => assinatura?.data.subscription.unsubscribe();
  }, [usuarioId]);

  useEffect(() => {
    if (!token) return;
    const controle = new AbortController();
    void listarAgendasGoogle(token, controle.signal).then(itens => {
      if (!controle.signal.aborted) setAgendas({ token, itens });
    }).catch(falha => {
      if (controle.signal.aborted) return;
      if (falha instanceof PermissaoGoogleAgenda) setToken(undefined);
      setErro(falha instanceof ErroGoogleAgenda ? falha.message : 'Não foi possível carregar suas agendas do Google. Verifique a conexão e tente novamente.');
    });
    return () => controle.abort();
  }, [token, tentativa]);

  useEffect(() => {
    if (!token || !agenda) return;
    const controle = new AbortController();
    void listarEventosGoogle(token, agenda, mes, controle.signal).then(dias => {
      if (!controle.signal.aborted) setEventos({ token, agenda, mes, dias });
    }).catch(falha => {
      if (controle.signal.aborted) return;
      if (falha instanceof PermissaoGoogleAgenda) setToken(undefined);
      setErro(falha instanceof ErroGoogleAgenda ? falha.message : 'Não foi possível carregar os compromissos do Google Agenda. Verifique a conexão e tente novamente.');
    });
    return () => controle.abort();
  }, [token, agenda, mes, tentativa]);

  async function conectar() {
    setAutorizando(true);
    setErro('');
    try { await autorizarGoogleAgenda(email); }
    catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível conectar ao Google Agenda.');
    } finally { setAutorizando(false); }
  }

  function selecionar(id: string) {
    localStorage.setItem(chave, id);
    setAgendaPreferida(id);
    setErro('');
  }

  async function publicar(visita: Visita, destino: string) {
    if (!token || !opcoes) throw new Error('Conecte o Google Agenda antes de reenviar.');
    const papelDestino = opcoes.find(item => item.id === destino)?.accessRole;
    if (papelDestino !== 'owner' && papelDestino !== 'writer') {
      throw new Error('A agenda de destino precisa permitir a criação de eventos.');
    }
    try {
      await criarEventoGoogle(token, destino, visita);
      setErro('');
      setTentativa(valor => valor + 1);
    } catch (falha) {
      if (falha instanceof PermissaoGoogleAgenda) setErro(falha.message);
      throw falha;
    }
  }

  const dias = eventos?.token === token && eventos?.agenda === agenda && eventos?.mes === mes
    ? eventos.dias : undefined;
  return {
    opcoes, agenda, dias, erro, autorizando, conectar, selecionar, publicar, podeCriar,
    destino: opcoes ? (podeCriar ? agenda : '') : agendaPreferida ?? '',
    carregando: Boolean(token && !erro && (!opcoes || (agenda && !dias))),
    tentarNovamente: token ? () => { setErro(''); setTentativa(valor => valor + 1); } : undefined,
  };
}
