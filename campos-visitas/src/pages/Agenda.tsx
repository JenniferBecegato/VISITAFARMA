
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  gerarId,
  dataAtual,
  type Visita
} from '../database/database';

import './Agenda.css';

const USUARIO_TESTE = 'usuario-local-teste';

function obterDataLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string) {
  return data.split('-').reverse().join('/');
}



export default function Agenda() {
  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [editandoId, setEditandoId] =
    useState<string | null>(null);

  const [medicoId, setMedicoId] = useState('');
  const [data, setData] = useState(obterDataLocal());
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [local, setLocal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const medicos = useLiveQuery(
    () => db.medicos
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  
const [historicoVisitaId, setHistoricoVisitaId] =
  useState<string | null>(null);

const historicoReagendamentos = useLiveQuery(
  () => db.historicoReagendamentos
    .where('usuarioId')
    .equals(USUARIO_TESTE)
    .toArray(),
  []
);

function alternarHistorico(visitaId: string) {
  setHistoricoVisitaId(anterior =>
    anterior === visitaId ? null : visitaId
  );
}


  const visitas = useLiveQuery(
    () => db.visitas
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  const medicosAtivos = (medicos ?? [])
    .filter(m => !m.excluidoEm)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const visitasOrdenadas = (visitas ?? [])
    .filter(v => !v.excluidoEm)
    .sort((a, b) =>
      `${a.data}T${a.horaInicio}`.localeCompare(
        `${b.data}T${b.horaInicio}`
      )
    );

  function nomeMedico(id: string) {
    return medicos?.find(m => m.id === id)?.nome
      ?? 'Médico não encontrado';
  }

  function limparFormulario() {
    setMedicoId('');
    setData(obterDataLocal());
    setHoraInicio('');
    setHoraFim('');
    setLocal('');
    setObservacoes('');
    setEditandoId(null);
    setErro('');
    setMostrarFormulario(false);
  }

  function editarVisita(visita: Visita) {
    setEditandoId(visita.id);
    setMedicoId(visita.medicoId);
    setData(visita.data);
    setHoraInicio(visita.horaInicio);
    setHoraFim(visita.horaFim || '');
    setLocal(visita.local || '');
    setObservacoes(visita.observacoes || '');
    setErro('');
    setMostrarFormulario(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvarVisita(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro('');

    if (!medicoId || !data || !horaInicio) {
      setErro('Preencha médico, data e horário.');
      return;
    }

    if (horaFim && horaFim <= horaInicio) {
      setErro('O horário final deve ser posterior ao inicial.');
      return;
    }

    const medico = medicosAtivos.find(m => m.id === medicoId);

    if (!medico) {
      setErro('Selecione um médico válido.');
      return;
    }

    setSalvando(true);

    try {
      const agora = dataAtual();

      if (editandoId) {

        const visitaAnterior = await db.visitas.get(editandoId);

  if (
    !visitaAnterior ||
    visitaAnterior.usuarioId !== USUARIO_TESTE
  ) {
    setErro('Visita não encontrada.');
    return;
  }

  if (visitaAnterior.status === 'cancelada') {
    setErro('Não é possível editar uma visita cancelada.');
    return;
  }

  const reagendada =
    visitaAnterior.data !== data ||
    visitaAnterior.horaInicio !== horaInicio;

  await db.transaction(
    'rw',
    db.visitas,
    db.historicoReagendamentos,
    async () => {
      if (reagendada) {
        await db.historicoReagendamentos.add({
          id: gerarId(),
          usuarioId: USUARIO_TESTE,
          visitaId: editandoId,

          dataAnterior: visitaAnterior.data,
          horaAnterior: visitaAnterior.horaInicio,

          dataNova: data,
          horaNova: horaInicio,

          alteradoEm: agora,
          sincronizacao: 'pendente'
        });
      }

      await db.visitas.update(editandoId, {
        medicoId,
        data,
        horaInicio,
        horaFim: horaFim || undefined,
        local: local.trim() || medico.clinica || undefined,
        observacoes: observacoes.trim(),

        status: reagendada
          ? 'reagendada'
          : visitaAnterior.status,

        statusGoogle: 'pendente',
        atualizadoEm: agora,
        sincronizacao: 'pendente'
      });
    }
  );
      } else {
        const novaVisita: Visita = {
          id: gerarId(),
          usuarioId: USUARIO_TESTE,
          medicoId,
          data,
          horaInicio,
          horaFim: horaFim || undefined,
          local: local.trim() || medico.clinica || undefined,
          observacoes: observacoes.trim(),
          status: 'agendada',
          statusGoogle: 'pendente',
          criadoEm: agora,
          atualizadoEm: agora,
          sincronizacao: 'pendente'
        };

        await db.visitas.add(novaVisita);
      }

      limparFormulario();
    } catch (error) {
      console.error(error);
      setErro('Não foi possível salvar a visita.');
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarVisita(visita: Visita) {
    if (
      !window.confirm(
        `Deseja cancelar a visita com ${nomeMedico(visita.medicoId)}?`
      )
    ) {
      return;
    }

    try {
      await db.visitas.update(visita.id, {
        status: 'cancelada',
        statusGoogle: 'pendente',
        sincronizacao: 'pendente',
        atualizadoEm: dataAtual()
      });
    } catch (error) {
      console.error(error);
      alert('Não foi possível cancelar a visita.');
    }
  }

  async function realizarVisita(visita: Visita) {
    if (
      !window.confirm(
        `Confirmar que a visita com ${nomeMedico(visita.medicoId)} foi realizada?`
      )
    ) {
      return;
    }

    try {
      await db.visitas.update(visita.id, {
        status: 'realizada',
        sincronizacao: 'pendente',
        atualizadoEm: dataAtual()
      });

      alert(
        'Visita marcada como realizada! ' +
        'Na próxima etapa, vamos conectar o formulário.'
      );
    } catch (error) {
      console.error(error);
      alert('Não foi possível atualizar a visita.');
    }
  }

  return (
    <div className="agenda-pagina">
      <header className="agenda-topo">
        <div>
          <h1>Agenda de Visitas</h1>
          <p>Organize suas visitas farmacêuticas.</p>
        </div>

        <button
          className="medicos-botao-principal"
          onClick={() => {
            limparFormulario();
            setMostrarFormulario(true);
          }}
        >
          + Nova visita
        </button>
      </header>

      {mostrarFormulario && (
        <section className="medicos-card">
          <h2>
            {editandoId ? 'Editar visita' : 'Agendar visita'}
          </h2>

          <form onSubmit={salvarVisita}>
            <div className="medicos-grid">
              <label>
                Médico *
                <select
                  required
                  value={medicoId}
                  onChange={e => setMedicoId(e.target.value)}
                >
                  <option value="">Selecione um médico</option>

                  {medicosAtivos.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} — {m.especialidade}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Data *
                <input
                  type="date"
                  required
                  value={data}
                  onChange={e => setData(e.target.value)}
                />
              </label>

              <label>
                Horário de início *
                <input
                  type="time"
                  required
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                />
              </label>

              <label>
                Horário de término
                <input
                  type="time"
                  value={horaFim}
                  onChange={e => setHoraFim(e.target.value)}
                />
              </label>

              <label>
                Local / Clínica
                <input
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                />
              </label>
            </div>

            <label className="agenda-observacoes">
              Observações
              <textarea
                rows={3}
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
              />
            </label>

            {erro && <p className="medicos-erro">{erro}</p>}

            <div className="medicos-acoes">
              <button
                type="button"
                onClick={limparFormulario}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="medicos-botao-principal"
                disabled={salvando}
              >
                {salvando
                  ? 'Salvando...'
                  : editandoId
                    ? 'Salvar alterações'
                    : 'Salvar visita'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="medicos-card">
        <h2>
          Visitas cadastradas ({visitasOrdenadas.length})
        </h2>

        {visitasOrdenadas.length === 0 ? (
          <p className="medicos-vazio">
            Nenhuma visita cadastrada.
          </p>
        ) : (
          <div className="agenda-lista">
            {visitasOrdenadas.map(visita => (
              <article className="agenda-item" key={visita.id}>
                <div className="agenda-item-horario">
                  {visita.horaInicio}
                </div>

                <div className="agenda-item-info">
                  <strong>{nomeMedico(visita.medicoId)}</strong>

                  <small>
                    {formatarData(visita.data)}
                    {' • '}
                    {visita.local || 'Local não informado'}
                  </small>

                  <span className={`inicio-status ${visita.status}`}>
                    {visita.status}
                  </span>
                </div>

                <div className="agenda-item-acoes">
                    <button
                     type="button"
                     className="agenda-botao-historico"
                     onClick={() => alternarHistorico(visita.id)}
                    >
                      {historicoVisitaId === visita.id
                        ? 'Fechar histórico'
                        : 'Histórico'}
                    </button>

                  {visita.status !== 'cancelada' && (
                    <>
                      <button
                        onClick={() => editarVisita(visita)}
                      >
                        Editar
                      </button>

                      {visita.status !== 'realizada' && (
                        <button
                          className="agenda-botao-realizar"
                          onClick={() => realizarVisita(visita)}
                        >
                          Realizar
                        </button>
                      )}

                      <button
                        className="agenda-botao-cancelar"
                        onClick={() => cancelarVisita(visita)}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
                
{historicoVisitaId === visita.id && (
  <div className="agenda-historico">
    <h3>Histórico de reagendamentos</h3>

    {(() => {
      const registros = (historicoReagendamentos ?? [])
        .filter(h => h.visitaId === visita.id)
        .sort((a, b) =>
          b.alteradoEm.localeCompare(a.alteradoEm)
        );

      if (registros.length === 0) {
        return (
          <p className="agenda-historico-vazio">
            Nenhum reagendamento registrado.
          </p>
        );
      }

      return registros.map(registro => (
        <div
          key={registro.id}
          className="agenda-historico-registro"
        >
          <span>
            <strong>Antes:</strong>{' '}
            {formatarData(registro.dataAnterior)}
            {' às '}
            {registro.horaAnterior}
          </span>

          <span>
            <strong>Depois:</strong>{' '}
            {formatarData(registro.dataNova)}
            {' às '}
            {registro.horaNova}
          </span>

          <small>
            Alterado em:{' '}
            {new Date(registro.alteradoEm)
              .toLocaleString('pt-BR')}
          </small>
        </div>
      ));
    })()}
  </div>
)}

              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
