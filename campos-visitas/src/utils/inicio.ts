import type { Visita } from '../database/database';
export function separarVisitas(visitas: Visita[], hoje: string) {
  const validas = visitas.filter(v => !v.excluidoEm);
  const ordenar = (a: Visita, b: Visita) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`);
  const visitasHoje = validas.filter(v => v.data === hoje).sort(ordenar);
  const proximasVisitas = validas.filter(v => v.data > hoje && v.data.slice(0, 7) === hoje.slice(0, 7) &&
    (v.status === 'agendada' || v.status === 'reagendada')).sort(ordenar);
  return { visitasHoje, proximasVisitas,
    realizadas: visitasHoje.filter(v => v.status === 'realizada').length,
    pendentes: visitasHoje.filter(v => v.status === 'agendada' || v.status === 'reagendada').length };
}
