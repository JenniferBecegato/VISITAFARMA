import { db, dataAtual, gerarId, type Produto, type Secretaria } from './database';
import { normalizarTexto } from '../utils/texto';

export type DadosProduto = Pick<Produto, 'nome' | 'categoria' | 'descricao' | 'observacoes' | 'ativo'>;

export async function salvarProduto(usuarioId: string, dados: DadosProduto, id?: string) {
  const nome = dados.nome.trim();
  if (!nome) throw new Error('Informe o nome do produto.');
  return db.transaction('rw', db.produtos, async () => {
    const existentes = await db.produtos.where('usuarioId').equals(usuarioId).toArray();
    if (existentes.some(p => p.id !== id && !p.excluidoEm && normalizarTexto(p.nome) === normalizarTexto(nome))) {
      throw new Error('Já existe um produto com esse nome. Edite o cadastro existente.');
    }
    const anterior = id ? await db.produtos.get(id) : undefined;
    if (id && (!anterior || anterior.usuarioId !== usuarioId || anterior.excluidoEm)) {
      throw new Error('Produto não encontrado.');
    }
    const agora = dataAtual();
    await db.produtos.put({ ...anterior, ...dados, nome,
      categoria: dados.categoria?.trim(), descricao: dados.descricao?.trim(),
      observacoes: dados.observacoes?.trim(), id: id ?? gerarId(), usuarioId,
      criadoEm: anterior?.criadoEm ?? agora, atualizadoEm: agora, sincronizacao: 'pendente' });
  });
}

export type DadosSecretaria = Pick<Secretaria, 'nome' | 'telefone' | 'localTrabalho' | 'observacoes'> & { medicoIds: string[] };
export async function salvarSecretaria(usuarioId: string, dados: DadosSecretaria, id?: string) {
  if (!dados.nome.trim()) throw new Error('Informe o nome da secretária.');
  if (!dados.medicoIds.length) throw new Error('Selecione pelo menos um médico.');
  return db.transaction('rw', db.secretarias, db.medicos, async () => {
    const anterior = id ? await db.secretarias.get(id) : undefined;
    if (id && (!anterior || anterior.usuarioId !== usuarioId || anterior.excluidoEm)) throw new Error('Secretária não encontrada.');
    for (const medicoId of dados.medicoIds) {
      const medico = await db.medicos.get(medicoId);
      if (!medico || medico.usuarioId !== usuarioId || medico.excluidoEm) throw new Error('Médico inválido.');
    }
    const agora = dataAtual();
    await db.secretarias.put({ ...anterior, ...dados, nome: dados.nome.trim(),
      telefone: dados.telefone?.trim(), localTrabalho: dados.localTrabalho?.trim(),
      observacoes: dados.observacoes?.trim(), medicoIds: [...new Set(dados.medicoIds)],
      medicoId: dados.medicoIds[0], id: id ?? gerarId(), usuarioId,
      criadoEm: anterior?.criadoEm ?? agora, atualizadoEm: agora, sincronizacao: 'pendente' });
  });
}

// Executar dentro da mesma transação do formulário para evitar vínculos parciais.
export async function gravarProdutosDaVisita(usuarioId: string, visitaId: string,
  selecionados: NonNullable<import('./database').FormularioVisita['produtosSelecionados']>) {
  const agora = dataAtual();
  const anteriores = await db.visitaProdutos.where('visitaId').equals(visitaId)
    .filter(v => v.usuarioId === usuarioId).toArray();
  const ids = new Set<string>();
  for (const item of selecionados) {
    if (ids.has(item.produtoId)) throw new Error('Produto repetido no formulário.');
    ids.add(item.produtoId);
    if (!Number.isSafeInteger(item.quantidadeAmostras) || item.quantidadeAmostras < 0) {
      throw new Error('Informe uma quantidade inteira de amostras, igual ou maior que zero.');
    }
    const produto = await db.produtos.get(item.produtoId);
    if (!produto || produto.usuarioId !== usuarioId || produto.excluidoEm) throw new Error('Produto indisponível.');
    const anterior = anteriores.find(v => v.produtoId === item.produtoId);
    await db.visitaProdutos.put({ ...anterior,
      id: anterior?.id ?? gerarId(), usuarioId, visitaId, produtoId: item.produtoId,
      quantidadeAmostras: item.quantidadeAmostras, criadoEm: anterior?.criadoEm ?? agora,
      atualizadoEm: agora, sincronizacao: 'pendente', excluidoEm: undefined });
  }
  for (const anterior of anteriores) {
    if (!ids.has(anterior.produtoId) && !anterior.excluidoEm) {
      await db.visitaProdutos.update(anterior.id, { excluidoEm: agora, atualizadoEm: agora, sincronizacao: 'pendente' });
    }
  }
}

export interface ContatoSecretaria { id?: string; nome: string }
// Chamado dentro da transação que salva o médico e suas secretárias.
export async function gravarSecretariasDoMedico(usuarioId: string, medicoId: string, campos: ContatoSecretaria[]) {
  const medico = await db.medicos.get(medicoId);
  if (!medico || medico.usuarioId !== usuarioId || medico.excluidoEm) throw new Error('Médico inválido.');
  const nomes = campos.map(c => c.nome.trim().replace(/\s+/g, ' '));
  if (nomes.some(n => !n)) throw new Error('Preencha o nome de todas as secretárias.');
  if (new Set(nomes.map(normalizarTexto)).size !== nomes.length) throw new Error('Informe nomes diferentes para as secretárias.');
  const anteriores = await db.secretarias.where('usuarioId').equals(usuarioId)
    .filter(s => !s.excluidoEm && (s.medicoIds ?? [s.medicoId]).includes(medicoId)).toArray();
  const ids: string[] = [];
  const agora = dataAtual();
  for (let indice = 0; indice < campos.length; indice++) {
    const campo = campos[indice];
    const anterior = campo.id ? anteriores.find(s => s.id === campo.id) :
      anteriores.find(s => normalizarTexto(s.nome) === normalizarTexto(nomes[indice]));
    if (campo.id && !anterior) throw new Error('O contato foi alterado. Reabra o cadastro do médico.');
    const id = anterior?.id ?? gerarId();
    if (ids.includes(id)) throw new Error('Selecione secretárias diferentes.');
    ids.push(id);
    await db.secretarias.put({ ...anterior, id, usuarioId, nome: nomes[indice],
      telefone: anterior?.telefone?.trim() || medico.telefone?.trim(),
      medicoId: anterior?.medicoId || medicoId, medicoIds: [...new Set([...(anterior?.medicoIds ?? (anterior ? [anterior.medicoId] : [])), medicoId])],
      criadoEm: anterior?.criadoEm ?? agora, atualizadoEm: agora, sincronizacao: 'pendente' });
  }
  for (const contato of anteriores) {
    if (!ids.includes(contato.id)) {
      const restantes = (contato.medicoIds ?? [contato.medicoId]).filter(id => id !== medicoId);
      await db.secretarias.update(contato.id, { medicoIds: restantes, medicoId: restantes[0] ?? '',
        atualizadoEm: agora, sincronizacao: 'pendente' });
    }
  }
  await db.medicos.update(medicoId, { secretariaId: ids[0], secretariaIds: ids });
}

// Executar na transação que salva o formulário e as visitas.
export async function gravarRetornoDoFormulario(
  formulario: import('./database').FormularioVisita,
  origem: import('./database').Visita,
  anterior?: import('./database').FormularioVisita
) {
  const data = formulario.dataProximoRetorno;
  const horaInicio = formulario.horaProximoRetorno;
  if (!data || !horaInicio || origem.excluidoEm || origem.status === 'cancelada') return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio)) return;
  // IDs de tabelas diferentes podem coincidir. Reutilizar o UUID do formulário
  // torna o retorno determinístico e compatível com as chaves UUID do Supabase.
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formulario.id)
    ? formulario.id : `retorno-formulario-${formulario.id}`;
  const retorno = await db.visitas.get(id);
  if (retorno && (retorno.usuarioId !== formulario.usuarioId || retorno.medicoId !== formulario.medicoId ||
    retorno.excluidoEm || retorno.status === 'realizada' || retorno.status === 'cancelada')) return;
  if (retorno && anterior?.dataProximoRetorno === data && anterior?.horaProximoRetorno === horaInicio) return;
  const agora = dataAtual();
  await db.visitas.put({ ...retorno, id, usuarioId: formulario.usuarioId, medicoId: formulario.medicoId,
    data, horaInicio, horaFim: undefined, local: retorno?.local ?? formulario.localClinica ?? origem.local,
    secretariaId: retorno?.secretariaId ?? origem.secretariaId,
    observacoes: retorno?.observacoes ?? 'Retorno previsto no formulário de visita.',
    status: retorno?.status ?? 'agendada', criadoEm: retorno?.criadoEm ?? agora,
    atualizadoEm: agora, sincronizacao: 'pendente', statusGoogle: 'pendente' });
}
