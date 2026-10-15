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

export type DadosAgendamento = Pick<Visita, 'medicoId' | 'data' | 'horaInicio' | 'horaFim' | 'local' | 'secretariaId' | 'observacoes'>;
export async function salvarAgendamento(usuarioId: string, dados: DadosAgendamento, id?: string, atualizadoEmEsperado?: string) {
  if (!dados.medicoId || !dados.data || !dados.horaInicio) throw new Error('Preencha médico, data e horário.');
  if (dados.horaFim && dados.horaFim <= dados.horaInicio) throw new Error('O horário final deve ser posterior ao inicial.');
  return db.transaction('rw', [db.visitas, db.medicos, db.secretarias, db.formularios, db.historicoReagendamentos], async () => {
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
    if (anterior && reagendada) await db.historicoReagendamentos.add({ id: gerarId(), usuarioId, visitaId: anterior.id,
      dataAnterior: anterior.data, horaAnterior: anterior.horaInicio, dataNova: dados.data, horaNova: dados.horaInicio,
      alteradoEm: agora, sincronizacao: 'pendente' });
    const visita: Visita = { ...anterior, ...dados, id: anterior?.id ?? gerarId(), usuarioId,
      horaFim: dados.horaFim || undefined, secretariaId: dados.secretariaId || undefined,
      local: dados.local?.trim() || medico.clinica || undefined, observacoes: dados.observacoes?.trim(),
      status: reagendada ? 'reagendada' : anterior?.status ?? 'agendada', criadoEm: anterior?.criadoEm ?? agora,
      atualizadoEm: agora, sincronizacao: 'pendente', statusGoogle: 'pendente' };
    await db.visitas.put(visita);
    return visita;
  });
}
