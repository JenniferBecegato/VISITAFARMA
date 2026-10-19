import type { FormularioVisita, Visita } from '../database/database';
import { dataLocal } from './relatorios';
export function formulariosPorData(formularios: FormularioVisita[], visitas: Visita[]) {
  const porDia = new Map<string, FormularioVisita>();
  for (const formulario of [...formularios].filter(f => !f.excluidoEm).sort((a, b) =>
    b.atualizadoEm.localeCompare(a.atualizadoEm) || b.id.localeCompare(a.id))) {
    const visita = visitas.find(v => v.id === formulario.visitaId);
    if (visita?.excluidoEm) continue;
    const data = visita?.data || dataLocal(new Date(formulario.criadoEm));
    if (!porDia.has(data)) porDia.set(data, formulario);
  }
  return [...porDia].sort(([a], [b]) => b.localeCompare(a)).map(([data, formulario]) => ({ data, formulario }));
}
