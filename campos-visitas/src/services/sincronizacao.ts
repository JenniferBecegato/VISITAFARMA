import { db } from '../database/database';
import { MotorSync, type TransporteSync } from './syncEngine';
import { SessaoInvalida, supabase, validarSessao } from './supabase';
import type { ConflitoSync } from '../database/syncTypes';

export interface EstadoSync {
  status: 'conferindo' | 'sincronizado' | 'offline' | 'pendente' | 'erro' | 'conflito';
  pendencias: number;
  ultima?: string;
  mensagem?: string;
}
const transporte: TransporteSync = {
  validar: validarSessao,
  async enviar(lote) {
    const { data, error } = await supabase!.rpc('sincronizar_lote', { lote });
    if (error) {
      if (error.code === 'PGRST301' || error.code === 'PGRST303' || error.code === '42501') throw new SessaoInvalida();
      throw new Error(`Não foi possível enviar os dados: ${error.message}`);
    }
    return data;
  },
  async baixar() {
    const { data, error } = await supabase!.rpc('baixar_snapshot');
    if (error) {
      if (error.code === 'PGRST301' || error.code === 'PGRST303') throw new SessaoInvalida();
      throw new Error(`Não foi possível conferir os dados: ${error.message}`);
    }
    if (!Array.isArray(data)) throw new Error('Snapshot inválido.');
    return data;
  }
};
export function iniciarSincronizacao(usuarioId: string, informar: (estado: EstadoSync) => void, sessaoInvalida: () => void) {
  const motor = new MotorSync(db, usuarioId, transporte);
  const chaveUltima = `campos-ultima-sync:${usuarioId}`;
  let ultima = localStorage.getItem(chaveUltima) ?? undefined;
  let executando = false;
  let repetir = false;
  let falhas = 0;
  let proximaTentativa = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let agendada: ReturnType<typeof setTimeout> | undefined;
  async function informarEstado(status: EstadoSync['status'], mensagem?: string) {
    const pendencias = await db.filaSincronizacao.where('usuarioId').equals(usuarioId).count();
    if (!motor.parado) informar({ status, pendencias, ultima, mensagem });
  }
  async function ciclo(forcar = false) {
    if (motor.parado) return;
    if (executando) { repetir = true; return; }
    if (!forcar && Date.now() < proximaTentativa) return;
    executando = true;
    clearTimeout(timer);
    try {
      if (!navigator.onLine) { await informarEstado('offline'); return; }
      await informarEstado('conferindo');
      const executar = () => motor.executar();
      const completo = navigator.locks
        ? await navigator.locks.request(`campos-sync:${usuarioId}`, executar) : await executar();
      if (motor.parado) return;
      falhas = 0; proximaTentativa = 0;
      const conflitos = await db.conflitosSync.where('usuarioId').equals(usuarioId).count();
      if (completo && !conflitos) {
        ultima = new Date().toISOString(); localStorage.setItem(chaveUltima, ultima);
      }
      await informarEstado(conflitos ? 'conflito' : completo ? 'sincronizado' : 'pendente');
    } catch (e) {
      if (motor.parado) return;
      if (e instanceof SessaoInvalida) { motor.parado = true; sessaoInvalida(); return; }
      await db.filaSincronizacao.where('usuarioId').equals(usuarioId).modify(p => { p.tentativas += 1; });
      await informarEstado(navigator.onLine ? 'erro' : 'offline', e instanceof Error ? e.message : 'Falha de conexão.');
      const atraso = Math.min(5000 * 2 ** Math.min(falhas++, 6), 300000);
      proximaTentativa = Date.now() + atraso;
      timer = setTimeout(() => void ciclo(), atraso);
    } finally {
      executando = false;
      if (repetir && !motor.parado) { repetir = false; agendar(); }
    }
  }
  function agendar() {
    clearTimeout(agendada);
    agendada = setTimeout(() => void ciclo(), 500);
    void informarEstado(navigator.onLine ? 'pendente' : 'offline');
  }
  const online = () => void ciclo(true);
  const offline = () => void informarEstado('offline');
  const visivel = () => { if (document.visibilityState === 'visible') void ciclo(); };
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  window.addEventListener('focus', visivel);
  window.addEventListener('campos-gravacao-local', agendar);
  document.addEventListener('visibilitychange', visivel);
  const intervalo = setInterval(() => { if (document.visibilityState === 'visible') void ciclo(); }, 60000);
  void ciclo();
  return {
    tentar: () => void ciclo(true),
    async resolver(conflito: ConflitoSync, escolha: 'local' | 'remoto') {
      await motor.resolver(conflito, escolha); void ciclo(true);
    },
    parar() {
      motor.parado = true; clearInterval(intervalo); clearTimeout(timer); clearTimeout(agendada);
      window.removeEventListener('online', online); window.removeEventListener('offline', offline);
      window.removeEventListener('focus', visivel); window.removeEventListener('campos-gravacao-local', agendar);
      document.removeEventListener('visibilitychange', visivel);
    }
  };
}
