import { useConta } from '../services/conta';
import { normalizarTexto } from '../utils/texto';
import { rotuloStatusVisita } from '../utils/statusVisita';

import { useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  type Visita
} from '../database/database';

import './Agenda.css';
import CalendarioVisitas from '../components/CalendarioVisitas';
import { alterarSituacaoVisita, salvarAgendamento } from '../database/visitas';


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



export default function Agenda({ visitaInicial, abrirPasta, abrirRelatorio }: {
  visitaInicial?: Visita;
  abrirPasta: (medicoId: string) => void;
  abrirRelatorio: (visita: Visita) => void;
}) {
  const { usuarioId } = useConta();
  const travaSituacao = useRef(false);
  const [atualizandoId, setAtualizandoId] = useState<string>();
  const [erroSituacao, setErroSituacao] = useState('');

  async function mudarSituacao(visita: Visita, status: 'realizada' | 'cancelada') {
    if (travaSituacao.current) return;
    if (!window.confirm(status === 'realizada' ? 'Marcar esta visita como realizada?' : 'Cancelar esta visita?')) return;
    travaSituacao.current = true;
    setAtualizandoId(visita.id);
    setErroSituacao('');
    try {
      await alterarSituacaoVisita(usuarioId, visita.id, status);
    } catch (erro) {
      setErroSituacao(erro instanceof Error ? erro.message : 'Não foi possível atualizar a visita.');
    } finally {
      travaSituacao.current = false;
      setAtualizandoId(undefined);
    }
  }
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
  const [produtosAssuntos, setProdutosAssuntos] = useState(visitaInicial?.produtosAssuntos ?? '');
  const [sugerirProdutos, setSugerirProdutos] = useState(false);
  const produtos = useLiveQuery(() => db.produtos.where('usuarioId').equals(usuarioId)
    .filter(p => !p.excluidoEm && p.ativo).sortBy('nome'), []);
  const termoProduto = normalizarTexto(produtosAssuntos.split(/[;,.]/).at(-1) ?? '');
  const sugestoesProdutos = termoProduto ? (produtos ?? []).filter(p => normalizarTexto(p.nome).includes(termoProduto)).slice(0, 6) : [];
  function selecionarProduto(nome: string) {
    const partes = produtosAssuntos.split(/[;,.]/);
    partes[partes.length - 1] = nome;
    setProdutosAssuntos(partes.map(p => p.trim()).filter(Boolean).join('; '));
    setSugerirProdutos(false);
  }
  const [secretariaId, setSecretariaId] = useState(visitaInicial?.secretariaId ?? '');
  const secretarias = useLiveQuery(() => db.secretarias.where('usuarioId').equals(usuarioId)
    .filter(s => !s.excluidoEm && (s.medicoIds ?? [s.medicoId]).includes(medicoId)).sortBy('nome'), [medicoId]);
  const [observacoes, setObservacoes] = useState(visitaInicial?.observacoes ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const medicos = useLiveQuery(
    () => db.medicos
      .where('usuarioId')
      .equals(usuarioId)
      .toArray(),
    []
  );

  
  const visitas = useLiveQuery(
    () => db.visitas
      .where('usuarioId')
      .equals(usuarioId)
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
    setProdutosAssuntos('');
    setSugerirProdutos(false);
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
    setProdutosAssuntos(visita.produtosAssuntos ?? '');
    setSugerirProdutos(false);
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
      await salvarAgendamento(usuarioId, { medicoId, data, horaInicio, horaFim, local, secretariaId, observacoes, produtosAssuntos },
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
              <div className="agenda-produtos-campo">
                <label>Produtos ou assuntos abordados na visita
                  <input value={produtosAssuntos} autoComplete="off" aria-describedby="agenda-produtos-ajuda"
                    onChange={e => { setProdutosAssuntos(e.target.value); setSugerirProdutos(true); }}
                    onFocus={() => setSugerirProdutos(true)} onKeyDown={e => { if (e.key === 'Escape') setSugerirProdutos(false); }}
                    placeholder="Digite um produto ou assunto" />
                </label>
                {sugerirProdutos && sugestoesProdutos.length > 0 && <div className="agenda-produtos-sugestoes" aria-label="Sugestões de produtos e assuntos">
                  {sugestoesProdutos.map(p => <button key={p.id} type="button" onClick={() => selecionarProduto(p.nome)}>{p.nome}</button>)}
                </div>}
                <small id="agenda-produtos-ajuda">Separe os itens com ; , ou .</small>
              </div>
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

      {erroSituacao && <p role="alert" className="medicos-erro">{erroSituacao}</p>}
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
                    {rotuloStatusVisita(visita.status)}
                  </span>
                </div>

                <div className="agenda-item-acoes" aria-busy={atualizandoId === visita.id}>
                  {visita.status !== 'realizada' && visita.status !== 'cancelada' && <div className="agenda-acoes-linha">
                    <button type="button" disabled={!!atualizandoId} className="agenda-botao-realizar"
                      onClick={() => void mudarSituacao(visita, 'realizada')}>Realizado</button>
                    <button type="button" disabled={!!atualizandoId} className="agenda-botao-cancelar"
                      onClick={() => void mudarSituacao(visita, 'cancelada')}>Cancelar</button>
                    <button type="button" disabled={!!atualizandoId} onClick={() => editarVisita(visita)}>Remarcar visita</button>
                  </div>}
                  <div className="agenda-acoes-linha">
                    {visita.status !== 'realizada' && visita.status !== 'cancelada' &&
                      <button type="button" disabled={!!atualizandoId} onClick={() => editarVisita(visita)}>Editar</button>}
                    <button type="button" disabled={!!atualizandoId} className="agenda-botao-formulario"
                      onClick={() => abrirRelatorio(visita)}>Formulário</button>
                  </div>
                </div>
                
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
