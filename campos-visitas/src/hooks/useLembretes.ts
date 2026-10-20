import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Visita } from '../database/database';
import { chaveLembrete, selecionarLembretes } from '../utils/lembretes';
import { ativarNotificacoes, atualizarSelo, desativarNotificacoes, suportaNotificacoes } from '../services/notificacoes';
import { supabase } from '../services/supabase';

export function useLembretes(usuarioId: string) {
  const [agora, setAgora] = useState(() => new Date());
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [ativo, setAtivo] = useState(() => localStorage.getItem('campos-push-usuario') === usuarioId &&
    suportaNotificacoes() && Notification.permission === 'granted');
  const visitas = useLiveQuery(() => db.visitas.where('usuarioId').equals(usuarioId).toArray(), [usuarioId]);
  const leituras = useLiveQuery(() => db.lembretesLidos.where('usuarioId').equals(usuarioId).toArray(), [usuarioId]);
  const pendentes = useMemo(() => selecionarLembretes(visitas ?? [], new Set(leituras?.map(l => l.chave)), agora), [visitas, leituras, agora]);
  const sincronizar = useCallback(async () => {
    if (!supabase || !navigator.onLine) return;
    const locais = await db.lembretesLidos.where('usuarioId').equals(usuarioId).filter(l => !l.enviado).limit(500).toArray();
    if (locais.length) {
      const { error } = await supabase.rpc('ler_lembretes', { leituras: locais.map(l => ({ visita_id: l.visitaId, data: l.data, hora_inicio: l.horaInicio.slice(0, 5) })) });
      if (error) return; // A leitura já está salva; a fila tenta novamente sem ocupar a tela com avisos repetidos.
      await db.lembretesLidos.bulkPut(locais.map(l => ({ ...l, enviado: 1 })));
    }
    const { data, error } = await supabase.from('lembretes_lidos').select('chave, visita_id, data, hora_inicio')
      .eq('usuario_id', usuarioId).gte('data', new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10));
    if (error) return; // O dashboard continua funcionando antes de aplicar a migração remota.
    await db.lembretesLidos.bulkPut((data ?? []).map(l => ({ id: `${usuarioId}/${l.chave}`, usuarioId,
      chave: l.chave, visitaId: l.visita_id, data: l.data, horaInicio: l.hora_inicio, enviado: 1 })));
  }, [usuarioId]);
  useEffect(() => {
    const atualizar = () => { setAgora(new Date()); void sincronizar().catch(e => setErro(e.message)); };
    const push = (evento: MessageEvent) => { if (evento.data?.tipo === 'ATUALIZAR_LEMBRETES' && evento.data.usuarioId === usuarioId) atualizar(); };
    atualizar();
    const timer = window.setInterval(atualizar, 60000);
    window.addEventListener('focus', atualizar); window.addEventListener('online', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    navigator.serviceWorker?.addEventListener('message', push);
    return () => { clearInterval(timer); window.removeEventListener('focus', atualizar); window.removeEventListener('online', atualizar);
      document.removeEventListener('visibilitychange', atualizar); navigator.serviceWorker?.removeEventListener('message', push); };
  }, [sincronizar, usuarioId]);
  useEffect(() => {
    if (!suportaNotificacoes()) return;
    void navigator.serviceWorker.getRegistration().then(async registro => {
      const assinatura = await registro?.pushManager.getSubscription();
      setAtivo(Boolean(assinatura && Notification.permission === 'granted' && localStorage.getItem('campos-push-usuario') === usuarioId));
    }).catch(() => setAtivo(false));
  }, [usuarioId]);
  useEffect(() => {
    if (visitas && leituras) void atualizarSelo(pendentes.map(chaveLembrete), usuarioId, leituras.map(l => l.chave));
  }, [pendentes, visitas, leituras, usuarioId]);
  async function marcarLido(visita: Visita) {
    try {
      const chave = chaveLembrete(visita);
      await db.lembretesLidos.put({ id: `${usuarioId}/${chave}`, usuarioId, chave, visitaId: visita.id,
        data: visita.data, horaInicio: visita.horaInicio.slice(0, 5), enviado: 0 });
      void sincronizar().catch(e => setErro(e.message));
    } catch { setErro('Não foi possível guardar a leitura. Tente novamente.'); }
  }
  async function alternar() {
    setOcupado(true); setErro('');
    try {
      if (ativo) await desativarNotificacoes(); else await ativarNotificacoes(usuarioId);
      setAtivo(!ativo);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível alterar as notificações.'); }
    finally { setOcupado(false); }
  }
  return { pendentes, marcarLido, alternar, ativo, ocupado, erro, suportado: suportaNotificacoes() };
}
export type ControleLembretes = ReturnType<typeof useLembretes>;
