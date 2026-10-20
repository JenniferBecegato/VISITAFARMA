import { useConta } from '../services/conta';
import { formulariosPorData } from '../utils/formularios';
import './PastaMedico.css';
import { rotuloStatusVisita } from '../utils/statusVisita';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/database';


interface PastaMedicoProps {
  medicoId: string;
  voltar: () => void;
  abrirFormulario: (
    medicoId: string,
    visitaId: string,
    formularioId?: string
  ) => void;
}



function formatarData(data: string) {
  if (!data) return '-';

  return data.split('-').reverse().join('/');
}


export default function PastaMedico({
  medicoId,
  voltar,
  abrirFormulario
}: PastaMedicoProps) {
  const { usuarioId } = useConta();


  const medico = useLiveQuery(
    () => db.medicos.get(medicoId),
    [medicoId]
  );

  const visitas = useLiveQuery(
    () => db.visitas
      .where('medicoId')
      .equals(medicoId)
      .filter(v =>
        v.usuarioId === usuarioId &&
        !v.excluidoEm
      )
      .toArray(),
    [medicoId]
  );

  const formularios = useLiveQuery(
    () => db.formularios
      .where('medicoId')
      .equals(medicoId)
      .filter(f =>
        f.usuarioId === usuarioId &&
        !f.excluidoEm
      )
      .toArray(),
    [medicoId]
  );

  const historicos = useLiveQuery(
    () => db.historicoReagendamentos
      .where('usuarioId')
      .equals(usuarioId)
      .filter(h =>
        (visitas ?? []).some(v => v.id === h.visitaId)
      )
      .toArray(),
    [medicoId, visitas]
  );

  if (
    medico === undefined ||
    visitas === undefined ||
    formularios === undefined
  ) {
    return <div className="medicos-pagina pasta-medico">Carregando...</div>;
  }

  if (
    !medico ||
    medico.usuarioId !== usuarioId ||
    medico.excluidoEm
  ) {
    return (
      <div className="medicos-pagina pasta-medico">
        <p>Médico não encontrado.</p>
        <button onClick={voltar}>Voltar</button>
      </div>
    );
  }

  const formulariosOrdenados = formulariosPorData(formularios, visitas);
  const visitasOrdenadas = [...visitas].sort((a, b) =>
    `${b.data}T${b.horaInicio}`.localeCompare(
      `${a.data}T${a.horaInicio}`
    )
  );

  return (
    <div className="medicos-pagina pasta-medico">
      <button
        onClick={voltar}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#0758bd',
          marginBottom: 20,
          padding: 0
        }}
      >
        ← Voltar para médicos
      </button>

      <section className="medicos-card">
        <h1 style={{ color: '#102d60' }}>
          {medico.nome}
        </h1>

        <p>{medico.especialidade}</p>

        <p>
          <strong>Clínica:</strong>{' '}
          {medico.clinica || 'Não informada'}
        </p>

        <p>
          <strong>CRM:</strong>{' '}
          {medico.crm
            ? `${medico.crm}/${medico.ufCrm || 'SP'}`
            : 'Não informado'}
        </p>

        <p>
          <strong>Telefone:</strong>{' '}
          {medico.telefone || 'Não informado'}
        </p>
      </section>

      <div className="inicio-indicadores">
        <div className="inicio-indicador azul">
          <span>Visitas</span>
          <strong>{visitas.length}</strong>
        </div>

        <div className="inicio-indicador verde">
          <span>Formulários</span>
          <strong>{formularios.length}</strong>
        </div>

        <div className="inicio-indicador amarelo">
          <span>Reagendamentos</span>
          <strong>{historicos?.length ?? 0}</strong>
        </div>
      </div>

      <details className="medicos-card pasta-historico">
        <summary><h2>Histórico de visitas</h2><span className="pasta-historico-seta" aria-hidden="true">⌄</span></summary>

        {visitasOrdenadas.length === 0 ? (
          <p className="medicos-vazio">
            Nenhuma visita cadastrada para este médico.
          </p>
        ) : (
          <div className="inicio-lista">
            {visitasOrdenadas.map(visita => (
              <div
                className="pasta-linha pasta-visita"
                key={visita.id}
              >
                <strong>{visita.horaInicio}</strong>

                <div>
                  <span>{formatarData(visita.data)}</span>
                  <small>
                    {visita.local || 'Local não informado'}
                  </small>
                </div>

                <span
                  className={`inicio-status ${visita.status}`}
                >
                  {rotuloStatusVisita(visita.status)}
                </span>
                
{visita.status !== 'cancelada' && (
  <button
    type="button"
    className="pasta-botao-relatorio"
    onClick={() => {
      const formularioExistente = formularios.find(
        formulario => formulario.visitaId === visita.id
      );

      abrirFormulario(
        medicoId,
        visita.id,
        formularioExistente?.id
      );
    }}
  >
    {visita.status === 'realizada' ? 'Formulário' : formularios.some(
      formulario => formulario.visitaId === visita.id
    )
      ? 'Editar relatório'
      : 'Preencher formulário'}
  </button>
)}

              </div>
            ))}
          </div>
        )}
      </details>

      <section className="medicos-card">
        <h2>Formulários de visitas</h2>

        {formulariosOrdenados.length === 0 ? (
          <p className="medicos-vazio">
            Nenhum formulário preenchido.
          </p>
        ) : (
          formulariosOrdenados.map(({ formulario, data }) => (
            <div
              key={formulario.id}
              className="pasta-linha pasta-formulario"
            >
              <div>
                <span>
                  {formatarData(data)}
                </span>


              </div>


              
<button
  type="button"
  className="pasta-botao-relatorio"
  onClick={() => abrirFormulario(
    medicoId,
    formulario.visitaId,
    formulario.id
  )}
>
  Formulário
</button>

            </div>
          ))
        )}
      </section>
    </div>
  );
}
