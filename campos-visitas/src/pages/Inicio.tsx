
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Visita } from '../database/database';
import './Inicio.css';

const USUARIO_TESTE = 'usuario-local-teste';

function obterDataLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string) {
  if (!data) return '';

  const [ano, mes, dia] = data.split('-');

  return `${dia}/${mes}/${ano}`;
}

export default function Inicio() {
  const visitas = useLiveQuery(
    () => db.visitas
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  const medicos = useLiveQuery(
    () => db.medicos
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  const dados = useMemo(() => {
    const hoje = obterDataLocal();

    const visitasValidas = (visitas ?? [])
      .filter(visita => !visita.excluidoEm);

    const visitasHoje = visitasValidas
      .filter(visita => visita.data === hoje)
      .sort((a, b) =>
        a.horaInicio.localeCompare(b.horaInicio)
      );

    const realizadas = visitasHoje.filter(
      visita => visita.status === 'realizada'
    ).length;

    const pendentes = visitasHoje.filter(
      visita =>
        visita.status === 'agendada' ||
        visita.status === 'reagendada'
    ).length;

    const proximasVisitas = visitasValidas
      .filter(visita => {
        if (
          visita.status === 'realizada' ||
          visita.status === 'cancelada'
        ) {
          return false;
        }

        return (
          `${visita.data}T${visita.horaInicio}` >=
          `${hoje}T${new Date().toTimeString().slice(0, 5)}`
        );
      })
      .sort((a, b) =>
        `${a.data}T${a.horaInicio}`.localeCompare(
          `${b.data}T${b.horaInicio}`
        )
      );

    return {
      visitasHoje,
      realizadas,
      pendentes,
      proximaVisita: proximasVisitas[0]
    };
  }, [visitas]);

  function nomeMedico(visita: Visita) {
    return medicos?.find(
      medico => medico.id === visita.medicoId
    )?.nome ?? 'Médico não encontrado';
  }

  return (
    <div className="inicio-pagina">
      <div className="inicio-topo">
        <div>
          <h1>Início</h1>
          <p>Resumo das suas visitas farmacêuticas.</p>
        </div>

        <span className="inicio-data">
          {formatarData(obterDataLocal())}
        </span>
      </div>

      <div className="inicio-indicadores">
        <div className="inicio-indicador azul">
          <span>Visitas de hoje</span>
          <strong>{dados.visitasHoje.length}</strong>
          <small>Agendamentos do dia</small>
        </div>

        <div className="inicio-indicador verde">
          <span>Realizadas</span>
          <strong>{dados.realizadas}</strong>
          <small>Visitas concluídas hoje</small>
        </div>

        <div className="inicio-indicador amarelo">
          <span>Pendentes</span>
          <strong>{dados.pendentes}</strong>
          <small>Aguardando realização</small>
        </div>
      </div>

      <section className="inicio-card">
        <h2>Próxima visita</h2>

        {dados.proximaVisita ? (
          <div className="inicio-proxima">
            <div className="inicio-horario">
              {dados.proximaVisita.horaInicio}
            </div>

            <div>
              <strong>{nomeMedico(dados.proximaVisita)}</strong>

              <p>
                {formatarData(dados.proximaVisita.data)}
              </p>

              <small>
                {dados.proximaVisita.local ||
                  'Local não informado'}
              </small>
            </div>
          </div>
        ) : (
          <p className="inicio-vazio">
            Nenhuma próxima visita agendada.
          </p>
        )}
      </section>

      <section className="inicio-card">
        <h2>Minhas visitas de hoje</h2>

        {dados.visitasHoje.length === 0 ? (
          <p className="inicio-vazio">
            Você não possui visitas cadastradas para hoje.
          </p>
        ) : (
          <div className="inicio-lista">
            {dados.visitasHoje.map(visita => (
              <div className="inicio-visita" key={visita.id}>
                <strong>{visita.horaInicio}</strong>

                <div>
                  <span>{nomeMedico(visita)}</span>
                  <small>
                    {visita.local || 'Local não informado'}
                  </small>
                </div>

                <span className={`inicio-status ${visita.status}`}>
                  {visita.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
