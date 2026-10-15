import type { Visita } from '../database/database';
import { dataLocal } from './relatorios';
export function diasDoMes(ano: number, mes: number) {
  const inicio = new Date(ano, mes, 1);
  const quantidade = new Date(ano, mes + 1, 0).getDate();
  const celulas: (string | null)[] = Array.from({ length: inicio.getDay() }, () => null);
  for (let dia = 1; dia <= quantidade; dia++) celulas.push(dataLocal(new Date(ano, mes, dia)));
  while (celulas.length % 7) celulas.push(null);
  return celulas;
}
export function visitasNaData(visitas: Visita[], data: string) {
  return visitas.filter(v => !v.excluidoEm && v.data === data).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}
