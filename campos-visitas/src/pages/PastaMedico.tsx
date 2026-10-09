
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


const USUARIO_TESTE = 'usuario-local-teste';

function formatarData(data: string) {
  if (!data) return '-';

  return data.split('-').reverse().join('/');
}


export default function PastaMedico({
  medicoId,
  voltar,
  abrirFormulario
}: PastaMedicoProps) {


  const medico = useLiveQuery(
    () => db.medicos.get(medicoId),
    [medicoId]
  );

  const visitas = useLiveQuery(
    () => db.visitas
      .where('medicoId')
      .equals(medicoId)
      .filter(v =>
        v.usuarioId === USUARIO_TESTE &&
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
        f.usuarioId === USUARIO_TESTE &&
        !f.excluidoEm
      )
      .toArray(),
    [medicoId]
  );

  const historicos = useLiveQuery(
    () => db.historicoReagendamentos
      .where('usuarioId')
      .equals(USUARIO_TESTE)
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
    return <div className="medicos-pagina">Carregando...</div>;
  }

  if (
    !medico ||
    medico.usuarioId !== USUARIO_TESTE ||
    medico.excluidoEm
  ) {
    return (
      <div className="medicos-pagina">
        <p>Médico não encontrado.</p>
        <button onClick={voltar}>Voltar</button>
      </div>
    );
  }

  const visitasOrdenadas = [...visitas].sort((a, b) =>
    `${b.data}T${b.horaInicio}`.localeCompare(
      `${a.data}T${a.horaInicio}`
    )
  );

  return (
    <div className="medicos-pagina">
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

      <section className="medicos-card">
        <h2>Histórico de visitas</h2>

        {visitasOrdenadas.length === 0 ? (
          <p className="medicos-vazio">
            Nenhuma visita cadastrada para este médico.
          </p>
        ) : (
          <div className="inicio-lista">
            {visitasOrdenadas.map(visita => (
              <div
                className="inicio-visita"
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
                  {visita.status}
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
    {formularios.some(
      formulario => formulario.visitaId === visita.id
    )
      ? 'Editar relatório'
      : 'Preencher relatório'}
  </button>
)}

              </div>
            ))}
          </div>
        )}
      </section>

      <section className="medicos-card">
        <h2>Formulários de visitas</h2>

        {formularios.length === 0 ? (
          <p className="medicos-vazio">
            Nenhum formulário preenchido.
          </p>
        ) : (
          formularios.map(formulario => (
            <div
              key={formulario.id}
              className="inicio-visita"
            >
              <div>
                <span>
                  {new Date(
                    formulario.criadoEm
                  ).toLocaleDateString('pt-BR')}
                </span>

                <small>{formulario.temaTrabalhado}</small>
              </div>

              <span className="inicio-status agendada">
                {formulario.status}
              </span>
              
<button
  type="button"
  className="pasta-botao-relatorio"
  onClick={() => abrirFormulario(
    medicoId,
    formulario.visitaId,
    formulario.id
  )}
>
  Abrir / Editar
</button>

            </div>
          ))
        )}
      </section>
    </div>
  );
}
