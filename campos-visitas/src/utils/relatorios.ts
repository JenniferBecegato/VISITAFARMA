import type { Medico, Produto, Visita, VisitaProduto } from '../database/database';
export function dataLocal(data = new Date()): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
export function diasAntes(dias: number, hoje = new Date()): string {
  const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  data.setDate(data.getDate() - dias);
  return dataLocal(data);
}
export function calcularRelatorio(medicos: Medico[], visitas: Visita[], produtos: Produto[], vinculos: VisitaProduto[],
  inicio: string, fim: string, hoje = new Date()) {
  const ativas = visitas.filter(v => !v.excluidoEm);
  const periodo = ativas.filter(v => v.data >= inicio && v.data <= fim);
  const realizadas = periodo.filter(v => v.status === 'realizada');
  const idsRealizadas = new Set(realizadas.map(v => v.id));
  const medicosAtivos = medicos.filter(m => !m.excluidoEm);
  const especialidades = new Map<string, number>();
  for (const visita of realizadas) {
    const especialidade = medicos.find(m => m.id === visita.medicoId)?.especialidade ?? 'Não informada';
    especialidades.set(especialidade, (especialidades.get(especialidade) ?? 0) + 1);
  }
  const porProduto = new Map<string, { nome: string; visitas: Set<string>; amostras: number }>();
  for (const item of vinculos.filter(v => !v.excluidoEm && idsRealizadas.has(v.visitaId))) {
    const resumo = porProduto.get(item.produtoId) ?? {
      nome: produtos.find(p => p.id === item.produtoId)?.nome ?? 'Produto indisponível', visitas: new Set<string>(), amostras: 0
    };
    resumo.visitas.add(item.visitaId);
    resumo.amostras += item.quantidadeAmostras ?? 0;
    porProduto.set(item.produtoId, resumo);
  }
  const limite = diasAntes(60, hoje);
  const semVisita = medicosAtivos.map(m => {
    const ultima = ativas.filter(v => v.medicoId === m.id && v.status === 'realizada' && v.data <= dataLocal(hoje))
      .map(v => v.data).sort().at(-1);
    return { medico: m, ultima };
  }).filter(item => !item.ultima || item.ultima < limite);
  return {
    periodo: periodo.sort((a, b) => `${b.data} ${b.horaInicio}`.localeCompare(`${a.data} ${a.horaInicio}`)),
    realizadas: realizadas.length,
    medicosVisitados: new Set(realizadas.map(v => v.medicoId)).size,
    status: (['agendada', 'realizada', 'reagendada', 'cancelada'] as const).map(status => ({ status, total: periodo.filter(v => v.status === status).length })),
    especialidades: [...especialidades].sort((a, b) => b[1] - a[1]),
    produtos: [...porProduto.values()].map(p => ({ nome: p.nome, visitas: p.visitas.size, amostras: p.amostras })).sort((a, b) => b.visitas - a.visitas),
    semVisita
  };
}
