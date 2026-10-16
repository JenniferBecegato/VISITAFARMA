import { db, dataAtual, gerarId, type Visita } from './database';
export function validarMudancaSituacao(visita: Visita, status: 'realizada' | 'cancelada') {
  if (visita.excluidoEm) throw new Error('Visita não encontrada.');
  if (visita.status === 'cancelada') throw new Error('Esta visita já foi cancelada.');
  if (status === 'cancelada' && visita.status === 'realizada') throw new Error('Uma visita realizada não pode ser cancelada.');
}
export async function alterarSituacaoVisita(usuarioId: string, visitaId: string, status: 'realizada' | 'cancelada') {
  await db.transaction('rw', db.visitas, db.formularios, async () => {
    const visita = await db.visitas.get(visitaId);
    if (!visita || visita.usuarioId !== usuarioId) throw new Error('Visita não encontrada.');
    validarMudancaSituacao(visita, status);
    if (status === 'cancelada') {
      const formularios = await db.formularios.where('visitaId').equals(visitaId).toArray();
      if (formularios.some(f => f.usuarioId === usuarioId && !f.excluidoEm && f.status === 'finalizado')) {
        throw new Error('Esta visita tem um formulário finalizado e não pode ser cancelada.');
      }
    }
    await db.visitas.update(visitaId, { status, atualizadoEm: dataAtual(), sincronizacao: 'pendente',
      ...(status === 'cancelada' ? { statusGoogle: 'pendente' as const } : {}) });
  });
}

export type DadosAgendamento = Pick<Visita, 'medicoId' | 'data' | 'horaInicio' | 'horaFim' | 'local' | 'secretariaId' | 'observacoes' | 'produtosAssuntos'>;
export async function salvarAgendamento(usuarioId: string, dados: DadosAgendamento, id?: string, atualizadoEmEsperado?: string) {
  if (!dados.medicoId || !dados.data || !dados.horaInicio) throw new Error('Preencha médico, data e horário.');
  if (dados.horaFim && dados.horaFim <= dados.horaInicio) throw new Error('O horário final deve ser posterior ao inicial.');
  return db.transaction('rw', [db.visitas, db.medicos, db.secretarias, db.formularios, db.historicoReagendamentos, db.produtos], async () => {
    const medico = await db.medicos.get(dados.medicoId);
    if (!medico || medico.usuarioId !== usuarioId || medico.excluidoEm) throw new Error('Selecione um médico válido.');
    if (dados.secretariaId) {
      const secretaria = await db.secretarias.get(dados.secretariaId);
      if (!secretaria || secretaria.usuarioId !== usuarioId || secretaria.excluidoEm ||
        !(secretaria.medicoIds ?? [secretaria.medicoId]).includes(medico.id)) throw new Error('Selecione uma secretária vinculada ao médico.');
    }
    const anterior = id ? await db.visitas.get(id) : undefined;
    if (id && (!anterior || anterior.usuarioId !== usuarioId || anterior.excluidoEm)) throw new Error('Visita não encontrada.');
    if (anterior?.status === 'cancelada') throw new Error('Não é possível editar uma visita cancelada.');
    if (anterior && atualizadoEmEsperado && anterior.atualizadoEm !== atualizadoEmEsperado) {
      throw new Error('Esta visita foi atualizada. Feche a edição e abra novamente para usar os dados recentes.');
    }
    const reagendada = Boolean(anterior && (anterior.data !== dados.data || anterior.horaInicio !== dados.horaInicio));
    if (anterior?.status === 'realizada' && reagendada) throw new Error('Uma visita realizada não pode ser reagendada.');
    if (anterior && anterior.medicoId !== dados.medicoId) {
      const formularios = await db.formularios.where('visitaId').equals(anterior.id).toArray();
      if (formularios.some(f => f.usuarioId === usuarioId && !f.excluidoEm)) throw new Error('Esta visita já possui relatório. Mantenha o médico vinculado.');
    }
    const agora = dataAtual();
    const normalizar = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
    const nomes = (dados.produtosAssuntos ?? anterior?.produtosAssuntos ?? '').split(/[;,.]/)
      .map(nome => nome.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (nomes.some(nome => nome.length > 160)) throw new Error('Cada produto ou assunto deve ter até 160 caracteres.');
    const catalogo = await db.produtos.where('usuarioId').equals(usuarioId).toArray();
    const produtoAssuntoIds: string[] = [];
    const nomesSalvos: string[] = [];
    for (const nome of nomes) {
      let produto = catalogo.find(p => !p.excluidoEm && normalizar(p.nome) === normalizar(nome));
      if (!produto) {
        produto = { id: gerarId(), usuarioId, nome, ativo: true, criadoEm: agora, atualizadoEm: agora, sincronizacao: 'pendente' };
        await db.produtos.add(produto);
        catalogo.push(produto);
      } else if (!produto.ativo) {
        await db.produtos.update(produto.id, { ativo: true, atualizadoEm: agora, sincronizacao: 'pendente' });
      }
      if (!produtoAssuntoIds.includes(produto.id)) {
        produtoAssuntoIds.push(produto.id);
        nomesSalvos.push(produto.nome);
      }
    }
    if (anterior && reagendada) await db.historicoReagendamentos.add({ id: gerarId(), usuarioId, visitaId: anterior.id,
      dataAnterior: anterior.data, horaAnterior: anterior.horaInicio, dataNova: dados.data, horaNova: dados.horaInicio,
      alteradoEm: agora, sincronizacao: 'pendente' });
    const visita: Visita = { ...anterior, ...dados, produtosAssuntos: nomesSalvos.join('; '), produtoAssuntoIds, id: anterior?.id ?? gerarId(), usuarioId,
      horaFim: dados.horaFim || undefined, secretariaId: dados.secretariaId || undefined,
      local: dados.local?.trim() || medico.clinica || undefined, observacoes: dados.observacoes?.trim(),
      status: reagendada ? 'reagendada' : anterior?.status ?? 'agendada', criadoEm: anterior?.criadoEm ?? agora,
      atualizadoEm: agora, sincronizacao: 'pendente', statusGoogle: 'pendente' };
    await db.visitas.put(visita);
    return visita;
  });
}

export async function atualizarVisitasRemarcadas(usuarioId: string, hoje: string) {
  return db.transaction('rw', db.visitas, async () => {
    const visitas = await db.visitas.where('usuarioId').equals(usuarioId).toArray();
    const vencidas = visitas.filter(v => !v.excluidoEm && v.status === 'reagendada' && v.data <= hoje);
    const agora = dataAtual();
    for (const visita of vencidas) {
      await db.visitas.update(visita.id, { status: 'agendada', atualizadoEm: agora, sincronizacao: 'pendente' });
    }
    return vencidas.length;
  });
}
