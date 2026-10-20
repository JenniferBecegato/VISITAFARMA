import type { Visita } from '../database/database';

export function chaveLembrete(visita: Pick<Visita, 'id' | 'data' | 'horaInicio'>) {
  return `${visita.id}/${visita.data}/${visita.horaInicio.slice(0, 5)}`;
}

export function calendarioLembretes(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  const hoje = `${valor('year')}-${valor('month')}-${valor('day')}`;
  const amanha = new Date(`${hoje}T12:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  return { hoje, amanha: amanha.toISOString().slice(0, 10), hora: Number(valor('hour')) };
}

export function selecionarLembretes(visitas: Visita[], lidos: Set<string>, agora = new Date()) {
  const { hoje, amanha, hora } = calendarioLembretes(agora);
  return visitas.filter(v => !v.excluidoEm && ['agendada', 'reagendada'].includes(v.status) &&
    (v.data === hoje || (v.data === amanha && hora >= 8)) && !lidos.has(chaveLembrete(v)))
    .sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`));
}
