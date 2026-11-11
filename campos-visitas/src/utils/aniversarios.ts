import type { Medico } from '../database/database';

export function aniversariosNoAno(medicos: Medico[], ano: number) {
  return medicos.filter(m => !m.excluidoEm && /^\d{4}-\d{2}-\d{2}$/.test(m.dataAniversario ?? '')).flatMap(m => {
    const data = `${ano}-${m.dataAniversario!.slice(5)}`;
    const dia = new Date(`${data}T12:00:00`);
    if (dia.getFullYear() !== ano || dia.getMonth() + 1 !== Number(data.slice(5, 7)) || dia.getDate() !== Number(data.slice(8))) return [];
    return [{ data, nome: `Aniversário — ${m.nome}`, tipo: 'comemorativo' as const }];
  });
}