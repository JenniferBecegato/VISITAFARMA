
import { useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  type Visita
} from '../database/database';

import './Agenda.css';
import CalendarioVisitas from '../components/CalendarioVisitas';
import { salvarAgendamento } from '../database/visitas';

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



export default function Agenda({ visitaInicial, abrirPasta }: { visitaInicial?: Visita; abrirPasta: (medicoId: string) => void }) {
  const travaSalvar = useRef(false);
  const [atualizadoEmEdicao, setAtualizadoEmEdicao] = useState(visitaInicial?.atualizadoEm);
  const [diaSelecionado, setDiaSelecionado] = useState(visitaInicial?.data ?? obterDataLocal());
  const [mostrarFormulario, setMostrarFormulario] =
    useState(Boolean(visitaInicial));

  const [editandoId, setEditandoId] =
    useState<string | null>(visitaInicial?.id ?? null);

  const [medicoId, setMedicoId] = useState(visitaInicial?.medicoId ?? '');
  const [data, setData] = useState(visitaInicial?.data ?? obterDataLocal());
  const [horaInicio, setHoraInicio] = useState(visitaInicial?.horaInicio ?? '');
  const [horaFim, setHoraFim] = useState(visitaInicial?.horaFim ?? '');
  const [local, setLocal] = useState(visitaInicial?.local ?? '');
  const [secretariaId, setSecretariaId] = useState(visitaInicial?.secretariaId ?? '');
  const secretarias = useLiveQuery(() => db.secretarias.where('usuarioId').equals(USUARIO_TESTE)
    .filter(s => !s.excluidoEm && (s.medicoIds ?? [s.medicoId]).includes(medicoId)).sortBy('nome'), [medicoId]);
  const [observacoes, setObservacoes] = useState(visitaInicial?.observacoes ?? '');
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
    .filter(v => !v.excluidoEm && v.data === diaSelecionado)
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
    setSecretariaId('');
    setObservacoes('');
    setEditandoId(null);
    setAtualizadoEmEdicao(undefined);
    setErro('');
    setMostrarFormulario(false);
  }

  function editarVisita(visita: Visita) {
    setEditandoId(visita.id);
    setAtualizadoEmEdicao(visita.atualizadoEm);
    setMedicoId(visita.medicoId);
    setData(visita.data);
    setHoraInicio(visita.horaInicio);
    setHoraFim(visita.horaFim || '');
    setLocal(visita.local || '');
    setSecretariaId(visita.secretariaId || '');
    setObservacoes(visita.observacoes || '');
    setErro('');
    setMostrarFormulario(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvarVisita(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (travaSalvar.current) return;
    travaSalvar.current = true; setSalvando(true); setErro('');
    try {
      await salvarAgendamento(USUARIO_TESTE, { medicoId, data, horaInicio, horaFim, local, secretariaId, observacoes },
        editandoId ?? undefined, atualizadoEmEdicao);
      setDiaSelecionado(data); limparFormulario();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar a visita.');
    } finally { travaSalvar.current = false; setSalvando(false); }
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
            setData(diaSelecionado);
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

          <form onSubmit={salvarVisita}><fieldset disabled={salvando} className="cadastro-campos">
            <div className="medicos-grid">
              <label>
                Médico *
                <select
                  required
                  value={medicoId}
                  onChange={e => {
                    setMedicoId(e.target.value);
                    setSecretariaId(medicosAtivos.find(m => m.id === e.target.value)?.secretariaId ?? '');
                    setLocal(medicosAtivos.find(m => m.id === e.target.value)?.clinica ?? '');
                  }}
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

            <label>Secretária
              <select value={secretariaId} onChange={e => setSecretariaId(e.target.value)}>
                <option value="">Sem secretária selecionada</option>
                {secretarias?.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="agenda-observacoes">
              Observações
              <textarea
                rows={3}
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
              />
            </label>

            {erro && <p role="alert" className="medicos-erro">{erro}</p>}

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
          </fieldset></form>
        </section>
      )}

      <CalendarioVisitas key={diaSelecionado.slice(0, 7)} visitas={visitas ?? []} medicos={medicos ?? []} selecionado={diaSelecionado}
        selecionar={setDiaSelecionado} agendar={dia => {
          limparFormulario(); setData(dia); setMostrarFormulario(true); window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
      <section className="medicos-card">
        <h2>
          Visitas de {formatarData(diaSelecionado)} ({visitasOrdenadas.length})
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
                  <button type="button" className="agenda-nome-medico" onClick={() => abrirPasta(visita.medicoId)}>{nomeMedico(visita.medicoId)}</button>

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
                  <button type="button" disabled={visita.status === 'cancelada'} onClick={() => editarVisita(visita)}>Editar</button>
                  <button type="button" className="agenda-botao-historico" aria-expanded={historicoVisitaId === visita.id}
                    onClick={() => alternarHistorico(visita.id)}>
                    {historicoVisitaId === visita.id ? 'Fechar histórico de reagendamento' : 'Histórico de reagendamento'}
                  </button>
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
