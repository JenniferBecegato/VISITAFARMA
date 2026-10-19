
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  db,
  gerarId,
  dataAtual,
  type FormularioVisita
} from '../database/database';

import './FormularioVisita.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { gravarProdutosDaVisita, gravarRetornoDoFormulario } from '../database/catalogos';

const USUARIO_TESTE = 'usuario-local-teste';

type DadosFormulario = Omit<
  FormularioVisita,
  | 'id'
  | 'usuarioId'
  | 'medicoId'
  | 'visitaId'
  | 'criadoEm'
  | 'atualizadoEm'
  | 'sincronizacao'
  | 'excluidoEm'
>;

interface Props {
  medicoId: string;
  visitaId: string;
  formularioId?: string;
  consultaCompleta?: boolean;
  voltar: () => void;
  registrarSaida: (salvar: (() => Promise<boolean>) | null) => void;
}

const dadosIniciais: DadosFormulario = {
  representante: 'Adriana',
  localClinica: '',
  nomeMedico: '',
  especialidade: '',
  perfilMedico: undefined,
  temaTrabalhado: '',
  produtosAbordados: '',
  produtosSelecionados: [],
  amostrasDeixadas: '',
  materiaisPromocionais: '',
  nivelInteresse: undefined,
  duvidasComentarios: '',
  anotacoesConcorrencia: '',
  acordadosSolicitacoes: '',
  objetivoProximaVisita: '',
  proximaVisitaAgendada: undefined,
  dataProximoRetorno: '',
  horaProximoRetorno: '',
  nomeSecretaria: '',
  anotacoesAdicionais: '',
  status: 'rascunho'
};

export default function FormularioVisita({
  medicoId,
  visitaId,
  formularioId,
  voltar,
  registrarSaida,
  consultaCompleta = false
}: Props) {
  const produtos = useLiveQuery(() => db.produtos.where('usuarioId').equals(USUARIO_TESTE)
    .filter(p => p.ativo && !p.excluidoEm).sortBy('nome'), []);
  const secretarias = useLiveQuery(() => db.secretarias.where('usuarioId').equals(USUARIO_TESTE)
    .filter(s => !s.excluidoEm && (s.medicoIds ?? [s.medicoId]).includes(medicoId)).sortBy('nome'), [medicoId]);
  const [editandoConsulta, setEditandoConsulta] = useState(false);
  const [confirmarVolta, setConfirmarVolta] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<DadosFormulario>(
    dadosIniciais
  );

  const [idAtual, setIdAtual] = useState(
    formularioId || gerarId()
  );

  const [criadoEm, setCriadoEm] = useState(dataAtual());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [alterado, setAlterado] = useState(false);
  const [estadoSalvamento, setEstadoSalvamento] = useState<
    'inicial' | 'salvando' | 'salvo' | 'erro'
  >('inicial');
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const dadosRef = useRef(dados);
  const criadoEmRef = useRef(criadoEm);
  const versaoRef = useRef(0);
  const versaoSalvaRef = useRef(0);
  const pendentesRef = useRef(0);
  const salvamentoRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let ativo = true;

    async function carregarFormulario() {
      setCarregando(true);

      try {
        const medico = await db.medicos.get(medicoId);
        const visita = await db.visitas.get(visitaId);

        if (
          !medico ||
          !visita ||
          medico.usuarioId !== USUARIO_TESTE ||
          visita.usuarioId !== USUARIO_TESTE ||
          visita.medicoId !== medicoId
        ) {
          throw new Error('Médico ou visita inválida.');
        }

        const formularioExistente = formularioId
          ? await db.formularios.get(formularioId)
          : (await db.formularios.where('visitaId').equals(visitaId)
            .filter(f => f.usuarioId === USUARIO_TESTE && !f.excluidoEm).toArray())
            .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0];

        if (formularioId && (
          !formularioExistente ||
          formularioExistente.usuarioId !== USUARIO_TESTE ||
          formularioExistente.medicoId !== medicoId ||
          formularioExistente.visitaId !== visitaId
        )) {
          throw new Error('Formulário não encontrado.');
        }

        const secretariaId = visita.secretariaId ?? medico.secretariaId;
        const secretaria = secretariaId ? await db.secretarias.get(secretariaId) : undefined;
        if (!ativo) return;

        if (formularioExistente) {
          const campos = Object.fromEntries(
            Object.keys(dadosIniciais).map(campo => [
              campo, formularioExistente[campo as keyof DadosFormulario]
            ])
          ) as DadosFormulario;

          dadosRef.current = campos;
          criadoEmRef.current = formularioExistente.criadoEm;
          setDados(campos);
          setEstadoSalvamento('salvo');
          setIdAtual(formularioExistente.id);
          setCriadoEm(formularioExistente.criadoEm);
        } else {
          const iniciais = {
            ...dadosIniciais,
            nomeMedico: medico.nome,
            especialidade: medico.especialidade,
            localClinica: visita.local || medico.clinica || '',
            perfilMedico: medico.perfil,
            nomeSecretaria: secretaria?.usuarioId === USUARIO_TESTE && !secretaria.excluidoEm &&
              (secretaria.medicoIds ?? [secretaria.medicoId]).includes(medicoId) ? secretaria.nome : ''
          };
          dadosRef.current = iniciais;
          setDados(iniciais);
        }
      } catch (erro) {
        console.error(erro);
        if (ativo) {
          setErroCarregamento(true);
          setMensagem('Não foi possível carregar o formulário.');
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarFormulario();

    return () => {
      ativo = false;
    };
  }, [medicoId, visitaId, formularioId]);

  
function alterar<K extends keyof DadosFormulario>(
  campo: K,
  valor: DadosFormulario[K]
) {
  const novosDados = { ...dadosRef.current, [campo]: valor };
  dadosRef.current = novosDados;
  versaoRef.current += 1;
  setDados(novosDados);
  setAlterado(true);
  setEstadoSalvamento('salvando');
  setMensagem('');
}

// Toda leitura e gravação acontece dentro desta mesma fila, inclusive a finalização.
const salvar = useCallback((finalizar = false): Promise<boolean> => {
  if (carregando || erroCarregamento) return Promise.resolve(false);
  pendentesRef.current += 1;
  setSalvando(true);
  setEstadoSalvamento('salvando');
  const gravacao = salvamentoRef.current.catch(() => undefined).then(async () => {
    // Obtém o estado mais recente quando chega a vez desta gravação.
    const versao = versaoRef.current;
    const campos = { ...dadosRef.current };
    const status = await db.transaction('rw', [db.formularios, db.visitas, db.produtos, db.visitaProdutos], async () => {
      const existente = await db.formularios.get(idAtual);
      const visita = await db.visitas.get(visitaId);
      if (!visita || visita.usuarioId !== USUARIO_TESTE || visita.medicoId !== medicoId) {
        throw new Error('Visita não encontrada.');
      }
      if (finalizar && visita.status === 'cancelada') {
        throw new Error('Não é possível finalizar uma visita cancelada.');
      }
      if (existente && (existente.usuarioId !== USUARIO_TESTE ||
        existente.medicoId !== medicoId || existente.visitaId !== visitaId)) {
        throw new Error('Formulário inválido.');
      }
      const agora = dataAtual();
      const formulario: FormularioVisita = {
        ...campos,
        id: idAtual,
        usuarioId: USUARIO_TESTE,
        medicoId,
        visitaId,
        status: finalizar || existente?.status === 'finalizado' ? 'finalizado' : 'rascunho',
        criadoEm: existente?.criadoEm ?? criadoEmRef.current,
        atualizadoEm: agora,
        sincronizacao: 'pendente'
      };
      await db.formularios.put(formulario);
      await gravarRetornoDoFormulario(formulario, visita, existente);
      if (campos.produtosSelecionados !== undefined) {
        await gravarProdutosDaVisita(USUARIO_TESTE, visitaId, campos.produtosSelecionados);
      }
      if (finalizar) {
        await db.visitas.update(visitaId, {
          status: 'realizada', atualizadoEm: agora, sincronizacao: 'pendente'
        });
      }
      return formulario.status;
    });
    versaoSalvaRef.current = versao;
    dadosRef.current = { ...dadosRef.current, status };
    setDados(atual => ({ ...atual, status }));
    // Uma gravação anterior nunca limpa a indicação de uma edição posterior.
    if (versaoRef.current === versao) {
      setAlterado(false);
      setEstadoSalvamento('salvo');
      setMensagem(finalizar ? 'Formulário finalizado e salvo offline!' : '');
    }
    return true;
  }).catch(erro => {
    console.error('Erro ao salvar formulário:', erro);
    setEstadoSalvamento('erro');
    setMensagem('Erro ao salvar. Tente novamente antes de sair.');
    return false;
  }).finally(() => {
    pendentesRef.current -= 1;
    if (pendentesRef.current === 0) setSalvando(false);
  });
  salvamentoRef.current = gravacao;
  return gravacao;
}, [carregando, erroCarregamento, idAtual, medicoId, visitaId]);

const salvarAntesDeSair = useCallback(async () => {
  if (carregando) return false;
  if (erroCarregamento) return true;
  if (consultaCompleta) {
    if (versaoRef.current !== versaoSalvaRef.current) { setMensagem('Salve as alterações antes de sair.'); return false; }
    return true;
  }
  // Repete se houve digitação enquanto a transação estava em andamento.
  do {
    if (!await salvar()) return false;
  } while (versaoRef.current !== versaoSalvaRef.current);
  return true;
}, [carregando, erroCarregamento, salvar, consultaCompleta]);

useEffect(() => {
  registrarSaida(salvarAntesDeSair);
  return () => registrarSaida(null);
}, [registrarSaida, salvarAntesDeSair]);

useEffect(() => {
  if (consultaCompleta || carregando || !alterado) return;
  const temporizador = window.setTimeout(() => { void salvar(); }, 1000);
  return () => window.clearTimeout(temporizador);
}, [dados, carregando, alterado, salvar, consultaCompleta]);

useEffect(() => {
  const antesDeFechar = (evento: BeforeUnloadEvent) => {
    if (versaoRef.current !== versaoSalvaRef.current || pendentesRef.current > 0) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  };
  const aoOcultar = () => {
    if (!consultaCompleta && document.visibilityState === 'hidden' && versaoRef.current !== versaoSalvaRef.current) {
      void salvar();
    }
  };
  window.addEventListener('beforeunload', antesDeFechar);
  document.addEventListener('visibilitychange', aoOcultar);
  return () => {
    window.removeEventListener('beforeunload', antesDeFechar);
    document.removeEventListener('visibilitychange', aoOcultar);
  };
}, [salvar, consultaCompleta]);

  async function avancar() {
    const sucesso = await salvar(false);

    if (sucesso && pagina < 6) {
      setPagina(anterior => anterior + 1);
    }
  }

  async function voltarPagina() {
    if (pagina > 1) {
      setPagina(anterior => anterior - 1);
    } else if (await salvarAntesDeSair()) {
      voltar();
    }
  }

  if (carregando) {
    return <div className="pagina-temporaria">Carregando formulário...</div>;
  }

  return (
    <div className="pagina-temporaria">
      {consultaCompleta && <div className="formulario-consulta-topo">
        <button type="button" disabled={salvando} onClick={() => { if (versaoRef.current !== versaoSalvaRef.current) setConfirmarVolta(true); else voltar(); }}>← Voltar</button>
        {!erroCarregamento && <button type="button" disabled={editandoConsulta || salvando} className="medicos-botao-principal" onClick={() => { setEditandoConsulta(true); setMensagem(''); }}>Editar</button>}
      </div>}
      <h1>Relatório de Visita Médica</h1>

      {!consultaCompleta && <p>Página {pagina} de 6</p>}
      {estadoSalvamento !== 'inicial' && (
        <p role="status" aria-live="polite" className={`salvamento-${estadoSalvamento}`}>
          {estadoSalvamento === 'salvando' ? 'Salvando...' :
            estadoSalvamento === 'erro' ? 'Erro ao salvar' : 'Salvo offline'}
        </p>
      )}

      <progress hidden={consultaCompleta}
        value={pagina}
        max={6}
        style={{ width: '100%', marginBottom: 20 }}
      />

      <fieldset className="formulario-conteudo" disabled={salvando || (consultaCompleta && !editandoConsulta)}>
      {!erroCarregamento && (consultaCompleta || pagina === 1) && (
        <section className="medicos-card">
          <h2>Informações iniciais</h2>

          <label>
            Representante
            <select
              value={dados.representante}
              onChange={e => alterar(
                'representante',
                e.target.value as 'Adriana' | 'Patricia'
              )}
            >
              <option value="Adriana">Adriana</option>
              <option value="Patricia">Patrícia</option>
            </select>
          </label>

          <label>
            Local / Clínica
            <input
              value={dados.localClinica}
              onChange={e => alterar(
                'localClinica',
                e.target.value
              )}
            />
          </label>
        </section>
      )}

      {!erroCarregamento && (consultaCompleta || pagina === 2) && (
        <section className="medicos-card">
          <h2>Dados do médico</h2>

          <label>
            Nome do médico
            <input
              value={dados.nomeMedico}
              onChange={e => alterar(
                'nomeMedico',
                e.target.value
              )}
            />
          </label>

          <label>
            Especialidade
            <input
              value={dados.especialidade}
              onChange={e => alterar(
                'especialidade',
                e.target.value
              )}
            />
          </label>

          <label>
            Perfil
            <select
              value={dados.perfilMedico || ''}
              onChange={e => alterar(
                'perfilMedico',
                e.target.value
                  ? e.target.value as DadosFormulario['perfilMedico']
                  : undefined
              )}
            >
              <option value="">Selecione</option>
              <option value="promotor">Promotor da marca</option>
              <option value="neutro">Neutro</option>
              <option value="concorrencia">Focado na concorrência</option>
            </select>
          </label>
        </section>
      )}

      {!erroCarregamento && (consultaCompleta || pagina === 3) && (
        <section className="medicos-card">
          <h2>Conteúdo da visita</h2>
          <label>Adicionar produto do catálogo
            <select value="" onChange={e => {
              const produto = produtos?.find(p => p.id === e.target.value);
              if (produto) alterar('produtosSelecionados', [...(dados.produtosSelecionados ?? []),
                { produtoId: produto.id, nome: produto.nome, quantidadeAmostras: 0 }]);
            }}>
              <option value="">Selecione um produto</option>
              {produtos?.filter(p => !dados.produtosSelecionados?.some(s => s.produtoId === p.id)).map(p =>
                <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          {dados.produtosSelecionados?.map(item => <div key={item.produtoId} className="formulario-produto">
            <strong>{item.nome}</strong>
            <label>Quantidade de amostras
              <input type="number" min="0" max="1000000" step="1" value={item.quantidadeAmostras}
                onChange={e => alterar('produtosSelecionados', (dados.produtosSelecionados ?? []).map(p =>
                  p.produtoId === item.produtoId ? { ...p, quantidadeAmostras: Number(e.target.value) } : p))} />
            </label>
            <button type="button" onClick={() => alterar('produtosSelecionados',
              (dados.produtosSelecionados ?? []).filter(p => p.produtoId !== item.produtoId))}>Remover {item.nome}</button>
          </div>)}
          <p>Você também pode informar outros produtos e amostras nos campos abaixo. Se não deixou amostras, escreva “Nenhuma”.</p>

          <label>
            Tema trabalhado
            <textarea
              value={dados.temaTrabalhado}
              onChange={e => alterar(
                'temaTrabalhado',
                e.target.value
              )}
            />
          </label>

          <label>
            Produtos abordados
            <textarea
              value={dados.produtosAbordados}
              onChange={e => alterar(
                'produtosAbordados',
                e.target.value
              )}
            />
          </label>

          <label>
            Amostras deixadas (produto e quantidade)
            <textarea
              value={dados.amostrasDeixadas}
              onChange={e => alterar(
                'amostrasDeixadas',
                e.target.value
              )}
            />
          </label>

          <label>
            Materiais promocionais entregues
            <textarea
              value={dados.materiaisPromocionais || ''}
              onChange={e => alterar(
                'materiaisPromocionais',
                e.target.value
              )}
            />
          </label>
        </section>
      )}

      {!erroCarregamento && (consultaCompleta || pagina === 4) && (
        <section className="medicos-card">
          <h2>Feedback e receptividade</h2>

          <label>
            Nível de interesse
            <select
              value={dados.nivelInteresse || ''}
              onChange={e => alterar(
                'nivelInteresse',
                e.target.value
                  ? e.target.value as DadosFormulario['nivelInteresse']
                  : undefined
              )}
            >
              <option value="">Selecione</option>
              <option value="alto">Alto</option>
              <option value="medio">Médio</option>
              <option value="baixo">Baixo</option>
            </select>
          </label>

          <label>
            Principais dúvidas, objeções ou comentários
            <textarea
              value={dados.duvidasComentarios || ''}
              onChange={e => alterar(
                'duvidasComentarios',
                e.target.value
              )}
            />
          </label>

          <label>
            Anotações sobre concorrência ou tratamento atual
            <textarea
              value={dados.anotacoesConcorrencia || ''}
              onChange={e => alterar(
                'anotacoesConcorrencia',
                e.target.value
              )}
            />
          </label>
        </section>
      )}

      {!erroCarregamento && (consultaCompleta || pagina === 5) && (
        <section className="medicos-card">
          <h2>Próximos passos e planos de ação</h2>

          <label>
            Acordados / Solicitações do médico
            <textarea
              value={dados.acordadosSolicitacoes || ''}
              onChange={e => alterar(
                'acordadosSolicitacoes',
                e.target.value
              )}
            />
          </label>

          <label>
            Objetivo / Tema para próxima visita
            <textarea
              value={dados.objetivoProximaVisita || ''}
              onChange={e => alterar(
                'objetivoProximaVisita',
                e.target.value
              )}
            />
          </label>

          <label>
            Já ficou agendado?
            <select
              value={
                dados.proximaVisitaAgendada === undefined
                  ? ''
                  : String(dados.proximaVisitaAgendada)
              }
              onChange={e => alterar(
                'proximaVisitaAgendada',
                e.target.value === ''
                  ? undefined
                  : e.target.value === 'true'
              )}
            >
              <option value="">Selecione</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </label>

          <label>
            Data prevista para retorno
            <input
              type="date"
              value={dados.dataProximoRetorno || ''}
              onChange={e => alterar(
                'dataProximoRetorno',
                e.target.value
              )}
            />
          </label>

          <label>
            Horário previsto
            <input
              type="time"
              value={dados.horaProximoRetorno || ''}
              onChange={e => alterar(
                'horaProximoRetorno',
                e.target.value
              )}
            />
          </label>
        </section>
      )}

      {!erroCarregamento && (consultaCompleta || pagina === 6) && (
        <section className="medicos-card">
          <h2>Observações de relacionamento</h2>
          {!!secretarias?.length && <label>Secretárias vinculadas ao médico
            <select value="" onChange={e => {
              const secretaria = secretarias.find(s => s.id === e.target.value);
              if (secretaria) alterar('nomeSecretaria', secretaria.nome);
            }}><option value="">Selecionar contato cadastrado</option>
              {secretarias.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select></label>}

          <label>
            Nome da secretária
            <input
              value={dados.nomeSecretaria}
              onChange={e => alterar(
                'nomeSecretaria',
                e.target.value
              )}
            />
          </label>

          <label>
            Anotações adicionais
            <textarea
              value={dados.anotacoesAdicionais || ''}
              onChange={e => alterar(
                'anotacoesAdicionais',
                e.target.value
              )}
              placeholder="Aniversário, hobbies, horários preferidos..."
            />
          </label>
        </section>
      )}

      </fieldset>
      {confirmarVolta && <div className="formulario-confirmacao-fundo">
        <div className="formulario-confirmacao" role="dialog" aria-modal="true" aria-labelledby="confirmar-volta-titulo">
          <h2 id="confirmar-volta-titulo">Deseja salvar as alterações?</h2>
          <p>Você tem alterações que ainda não foram salvas.</p>
          <div className="formulario-confirmacao-acoes">
            <button type="button" disabled={salvando} autoFocus onClick={() => setConfirmarVolta(false)}>Continuar editando</button>
            <button type="button" disabled={salvando} onClick={() => { setConfirmarVolta(false); voltar(); }}>Sair sem salvar</button>
            <button type="button" className="medicos-botao-principal" disabled={salvando} onClick={async () => {
              if (await salvar(false)) { setConfirmarVolta(false); voltar(); }
              else setConfirmarVolta(false);
            }}>{salvando ? 'Salvando...' : 'Salvar e voltar'}</button>
          </div>
        </div>
      </div>}
      {mensagem && (
        <p role="status">{mensagem}</p>
      )}

      {consultaCompleta ? (editandoConsulta && <div className="medicos-acoes formulario-acoes-edicao">
        <button type="button" className="medicos-botao-principal" disabled={salvando || erroCarregamento} onClick={async () => {
          if (await salvar(false)) { setEditandoConsulta(false); setMensagem('Alterações salvas.'); }
        }}>Salvar alterações</button>
      </div>) : <div className="medicos-acoes">
        <button
          type="button"
          disabled={salvando}
          onClick={() => void voltarPagina()}
        >
          {!erroCarregamento && pagina === 1 ? 'Voltar' : 'Anterior'}
        </button>

        

        {pagina < 6 ? (
          <button
            type="button"
            className="medicos-botao-principal"
            disabled={salvando || erroCarregamento}
            onClick={() => void avancar()}
          >
            Próximo
          </button>
        ) : (
          <button
            type="button"
            className="medicos-botao-principal"
            disabled={salvando || erroCarregamento}
            
onClick={() => void salvar(true)}

          >
            Finalizar formulário
          </button>
        )}
      </div>}
    </div>
  );
}
