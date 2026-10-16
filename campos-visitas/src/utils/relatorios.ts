import type { Medico, Produto, Visita, VisitaProduto, FormularioVisita } from '../database/database';
export function dataLocal(data = new Date()): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
export function diasAntes(dias: number, hoje = new Date()): string {
  const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  data.setDate(data.getDate() - dias);
  return dataLocal(data);
}
export function calcularRelatorio(medicos: Medico[], visitas: Visita[], produtos: Produto[], vinculos: VisitaProduto[],
  inicio: string, fim: string, hoje = new Date(), formularios: FormularioVisita[] = []) {
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
  const normalizar = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
  for (const visita of periodo) {
    const nomes = (visita.produtosAssuntos ?? '').split(/[;,.]/).map(n => n.trim()).filter(Boolean);
    const itens = visita.produtoAssuntoIds?.length
      ? visita.produtoAssuntoIds.map((id, indice) => ({ id, nome: produtos.find(p => p.id === id)?.nome ?? nomes[indice] ?? 'Produto indisponível' }))
      : nomes.map(nome => {
        const produto = produtos.find(p => normalizar(p.nome) === normalizar(nome));
        return { id: produto?.id ?? `texto:${normalizar(nome)}`, nome: produto?.nome ?? nome };
      });
    for (const item of itens) {
      const resumo = porProduto.get(item.id) ?? { nome: item.nome, visitas: new Set<string>(), amostras: 0 };
      resumo.visitas.add(visita.id);
      porProduto.set(item.id, resumo);
    }
  }
  for (const formulario of formularios.filter(f => !f.excluidoEm && idsRealizadas.has(f.visitaId))) {
    const adicionar = (nome: string, produtoId?: string, amostras = 0) => {
      const produto = produtos.find(p => p.id === produtoId || normalizar(p.nome) === normalizar(nome));
      const existente = [...porProduto.entries()].find(([, p]) => normalizar(p.nome) === normalizar(nome));
      const chave = produto?.id ?? existente?.[0] ?? `texto:${normalizar(nome)}`;
      const resumo = porProduto.get(chave) ?? { nome: produto?.nome ?? nome, visitas: new Set<string>(), amostras: 0 };
      resumo.visitas.add(formulario.visitaId);
      if (produtoId && !vinculos.some(v => !v.excluidoEm && v.visitaId === formulario.visitaId && v.produtoId === produtoId)) resumo.amostras += amostras;
      porProduto.set(chave, resumo);
    };
    for (const item of formulario.produtosSelecionados ?? []) adicionar(item.nome, item.produtoId, item.quantidadeAmostras);
    for (const nome of [formulario.produtosAbordados, formulario.temaTrabalhado].filter(Boolean).join(';').split(/[;,.\n]/).map(n => n.trim()).filter(Boolean)) adicionar(nome);
  }
  const limite = diasAntes(60, hoje);
  const semVisita = medicosAtivos.map(m => {
    const visita = ativas.filter(v => v.medicoId === m.id && v.status === 'realizada' && v.data <= dataLocal(hoje))
      .sort((a, b) => `${b.data} ${b.horaInicio}`.localeCompare(`${a.data} ${a.horaInicio}`))[0];
    const nomes = new Map<string, string>();
    const adicionar = (nome?: string) => { if (nome?.trim()) nomes.set(normalizar(nome), nome.trim()); };
    if (visita) {
      (visita.produtoAssuntoIds ?? []).forEach(id => adicionar(produtos.find(p => p.id === id)?.nome));
      (visita.produtosAssuntos ?? '').split(/[;,.\n]/).forEach(adicionar);
      vinculos.filter(v => !v.excluidoEm && v.visitaId === visita.id).forEach(v => adicionar(produtos.find(p => p.id === v.produtoId)?.nome));
      formularios.filter(f => !f.excluidoEm && f.visitaId === visita.id).forEach(f => {
        (f.produtosSelecionados ?? []).forEach(p => adicionar(p.nome));
        [f.produtosAbordados, f.temaTrabalhado].filter(Boolean).join(';').split(/[;,.\n]/).forEach(adicionar);
      });
    }
    return { medico: m, ultima: visita?.data, produtosAssuntos: [...nomes.values()].join('; ') };
  }).filter(item => !item.ultima || item.ultima < limite);
  return {
    periodo: periodo.sort((a, b) => `${b.data} ${b.horaInicio}`.localeCompare(`${a.data} ${a.horaInicio}`)),
    realizadas: realizadas.length,
    medicosVisitados: new Set(realizadas.map(v => v.medicoId)).size,
    status: (['agendada', 'realizada', 'reagendada', 'cancelada'] as const).map(status => ({ status, total: periodo.filter(v => v.status === status).length })),
    especialidades: [...especialidades].sort((a, b) => b[1] - a[1]),
    produtos: [...porProduto.values()].map(p => {
      const medicoIds = new Set(periodo.filter(v => p.visitas.has(v.id)).map(v => v.medicoId));
      const nomesMedicos = [...medicoIds].map(id => medicos.find(m => m.id === id)?.nome ?? 'Médico não encontrado')
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      return { nome: p.nome, visitas: p.visitas.size, medicos: nomesMedicos, amostras: p.amostras };
    }).sort((a, b) => b.visitas - a.visitas),
    semVisita
  };
}
