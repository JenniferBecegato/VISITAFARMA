import type { Visita } from '../database/database';
export function filtrarHistorico(visitas: Visita[], ano: number, inicio: string, fim: string) {
  return visitas.filter(v => !v.excluidoEm && v.data.startsWith(`${ano}-`) && v.data >= inicio && v.data <= fim)
    .sort((a, b) => `${b.data} ${b.horaInicio}`.localeCompare(`${a.data} ${a.horaInicio}`));
}
