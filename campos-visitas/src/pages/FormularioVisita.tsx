
import { useEffect, useRef, useState } from 'react';
import {
  db,
  gerarId,
  dataAtual,
  type FormularioVisita
} from '../database/database';

import './FormularioVisita.css';

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
  voltar: () => void;
}

const dadosIniciais: DadosFormulario = {
  representante: 'Adriana',
  localClinica: '',
  nomeMedico: '',
  especialidade: '',
  perfilMedico: undefined,
  temaTrabalhado: '',
  produtosAbordados: '',
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
  voltar
}: Props) {
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

const dadosRef = useRef(dados);
const criadoEmRef = useRef(criadoEm);
const salvamentoRef = useRef<Promise<void>>(
  Promise.resolve()
);

useEffect(() => {
  dadosRef.current = dados;
}, [dados]);

useEffect(() => {
  criadoEmRef.current = criadoEm;
}, [criadoEm]);

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
          : undefined;

        if (formularioId && (
          !formularioExistente ||
          formularioExistente.usuarioId !== USUARIO_TESTE ||
          formularioExistente.medicoId !== medicoId ||
          formularioExistente.visitaId !== visitaId
        )) {
          throw new Error('Formulário não encontrado.');
        }

        if (!ativo) return;

        if (formularioExistente) {
          const {
            id: _id,
            usuarioId: _usuarioId,
            medicoId: _medicoId,
            visitaId: _visitaId,
            criadoEm: _criadoEm,
            atualizadoEm: _atualizadoEm,
            sincronizacao: _sincronizacao,
            excluidoEm: _excluidoEm,
            ...campos
          } = formularioExistente;

          setDados(campos);
          setIdAtual(formularioExistente.id);
          setCriadoEm(formularioExistente.criadoEm);
        } else {
          setDados({
            ...dadosIniciais,
            nomeMedico: medico.nome,
            especialidade: medico.especialidade,
            localClinica: visita.local || medico.clinica || '',
            perfilMedico: medico.perfil
          });
        }
      } catch (erro) {
        console.error(erro);
        if (ativo) {
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
  setDados(anterior => {
    const novosDados = {
      ...anterior,
      [campo]: valor
    };

    dadosRef.current = novosDados;
    return novosDados;
  });

  setAlterado(true);
  setMensagem('');
}


useEffect(() => {
  if (carregando || !alterado) return;

  const temporizador = window.setTimeout(() => {
    const dadosParaSalvar = { ...dadosRef.current };

    salvamentoRef.current = salvamentoRef.current
      .catch(() => undefined)
      .then(async () => {
        const existente = await db.formularios.get(idAtual);

        const formulario: FormularioVisita = {
          ...dadosParaSalvar,
          id: idAtual,
          usuarioId: USUARIO_TESTE,
          medicoId,
          visitaId,
          status: existente?.status ?? 'rascunho',
          criadoEm: existente?.criadoEm ?? criadoEmRef.current,
          atualizadoEm: dataAtual(),
          sincronizacao: 'pendente'
        };

        await db.formularios.put(formulario);
      });

    void salvamentoRef.current
      .then(() => {
        setAlterado(false);
        setMensagem('Alterações salvas automaticamente.');
      })
      .catch(erro => {
        console.error('Erro no salvamento automático:', erro);
        setMensagem('Não foi possível salvar automaticamente.');
      });
  }, 1000);

  return () => window.clearTimeout(temporizador);
}, [dados, carregando, alterado, idAtual, medicoId, visitaId]);



function validarFormulario(): boolean {
  const campos = dadosRef.current;

  const obrigatorio = (valor?: string) =>
    Boolean(valor?.trim());

  if (
    !obrigatorio(campos.representante) ||
    !obrigatorio(campos.localClinica)
  ) {
    setPagina(1);
    setMensagem(
      'Preencha os campos obrigatórios das informações iniciais.'
    );
    return false;
  }

  if (
    !obrigatorio(campos.nomeMedico) ||
    !obrigatorio(campos.especialidade)
  ) {
    setPagina(2);
    setMensagem(
      'Preencha o nome e a especialidade do médico.'
    );
    return false;
  }

  if (
    !obrigatorio(campos.temaTrabalhado) ||
    !obrigatorio(campos.produtosAbordados) ||
    !obrigatorio(campos.amostrasDeixadas)
  ) {
    setPagina(3);
    setMensagem(
      'Preencha tema trabalhado, produtos abordados e amostras deixadas.'
    );
    return false;
  }

  if (!campos.nivelInteresse) {
    setPagina(4);
    setMensagem('Selecione o nível de interesse.');
    return false;
  }

  if (campos.proximaVisitaAgendada === undefined) {
    setPagina(5);
    setMensagem(
      'Informe se a próxima visita já ficou agendada.'
    );
    return false;
  }

  if (!obrigatorio(campos.nomeSecretaria)) {
    setPagina(6);
    setMensagem('Informe o nome da secretária.');
    return false;
  }

  return true;
}


async function salvar(finalizar = false) {
  setSalvando(true);
  setMensagem('');

  try {
    // Aguarda qualquer gravação automática anterior.
    await salvamentoRef.current;

    const agora = dataAtual();
    const existente = await db.formularios.get(idAtual);

    const formulario: FormularioVisita = {
      ...dadosRef.current,
      id: idAtual,
      usuarioId: USUARIO_TESTE,
      medicoId,
      visitaId,
      
status:
  finalizar || existente?.status === 'finalizado'
    ? 'finalizado'
    : 'rascunho',

      criadoEm: existente?.criadoEm ?? criadoEmRef.current,
      atualizadoEm: agora,
      sincronizacao: 'pendente'
    };

    
const gravacao = salvamentoRef.current.then(async () => {
  await db.transaction(
    'rw',
    db.formularios,
    db.visitas,
    async () => {
      const visita = await db.visitas.get(visitaId);

      if (
        !visita ||
        visita.usuarioId !== USUARIO_TESTE ||
        visita.medicoId !== medicoId
      ) {
        throw new Error('Visita não encontrada.');
      }

      if (visita.status === 'cancelada') {
        throw new Error(
          'Não é possível finalizar uma visita cancelada.'
        );
      }

      await db.formularios.put(formulario);

      if (finalizar) {
        await db.visitas.update(visitaId, {
          status: 'realizada',
          atualizadoEm: agora,
          sincronizacao: 'pendente'
        });
      }
    }
  );
});

salvamentoRef.current = gravacao;

await gravacao;


    setDados(anterior => ({
      ...anterior,
      status: formulario.status
    }));

    setAlterado(false);

    setMensagem(
      finalizar
        ? 'Formulário finalizado e salvo offline!'
        : 'Rascunho salvo no dispositivo!'
    );

    return true;
  } catch (erro) {
    console.error(erro);
    setMensagem('Erro ao salvar. Tente novamente.');
    return false;
  } finally {
    setSalvando(false);
  }
}


  async function avancar() {
    const sucesso = await salvar(false);

    if (sucesso && pagina < 6) {
      setPagina(anterior => anterior + 1);
    }
  }

  function voltarPagina() {
    if (pagina > 1) {
      setPagina(anterior => anterior - 1);
    } else {
      voltar();
    }
  }

  if (carregando) {
    return <div className="pagina-temporaria">Carregando formulário...</div>;
  }

  return (
    <div className="pagina-temporaria">
      <h1>Relatório de Visita Médica</h1>

      <p>Página {pagina} de 6</p>

      <progress
        value={pagina}
        max={6}
        style={{ width: '100%', marginBottom: 20 }}
      />

      {pagina === 1 && (
        <section className="medicos-card">
          <h2>Informações iniciais</h2>

          <label>
            Representante *
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
            Local / Clínica *
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

      {pagina === 2 && (
        <section className="medicos-card">
          <h2>Dados do médico</h2>

          <label>
            Nome do médico *
            <input
              value={dados.nomeMedico}
              onChange={e => alterar(
                'nomeMedico',
                e.target.value
              )}
            />
          </label>

          <label>
            Especialidade *
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

      {pagina === 3 && (
        <section className="medicos-card">
          <h2>Conteúdo da visita</h2>

          <label>
            Tema trabalhado *
            <textarea
              value={dados.temaTrabalhado}
              onChange={e => alterar(
                'temaTrabalhado',
                e.target.value
              )}
            />
          </label>

          <label>
            Produtos abordados *
            <textarea
              value={dados.produtosAbordados}
              onChange={e => alterar(
                'produtosAbordados',
                e.target.value
              )}
            />
          </label>

          <label>
            Amostras deixadas (produto e quantidade) *
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

      {pagina === 4 && (
        <section className="medicos-card">
          <h2>Feedback e receptividade</h2>

          <label>
            Nível de interesse *
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

      {pagina === 5 && (
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
            Já ficou agendado? *
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

      {pagina === 6 && (
        <section className="medicos-card">
          <h2>Observações de relacionamento</h2>

          <label>
            Nome da secretária *
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

      {mensagem && (
        <p role="status">{mensagem}</p>
      )}

      <div className="medicos-acoes">
        <button
          type="button"
          onClick={voltarPagina}
        >
          {pagina === 1 ? 'Voltar' : 'Anterior'}
        </button>

        <button
          type="button"
          disabled={salvando}
          onClick={() => void salvar(false)}
        >
          Salvar rascunho
        </button>

        {pagina < 6 ? (
          <button
            type="button"
            className="medicos-botao-principal"
            disabled={salvando}
            onClick={() => void avancar()}
          >
            Próximo
          </button>
        ) : (
          <button
            type="button"
            className="medicos-botao-principal"
            disabled={salvando}
            
onClick={() => {
  if (validarFormulario()) {
    void salvar(true);
  }
}}

          >
            Finalizar formulário
          </button>
        )}
      </div>
    </div>
  );
}
