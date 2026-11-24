import CamposSecretarias from '../components/CamposSecretarias';
import type { ContatoSecretaria } from '../database/catalogos';
import { useConta } from '../services/conta';
import { correspondeBuscaMedico, normalizarNomeMedico, normalizarTexto } from '../utils/texto';
import { rotuloStatusVisita } from '../utils/statusVisita';

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  type Visita
} from '../database/database';

import './Agenda.css';
import CalendarioVisitas from '../components/CalendarioVisitas';
import { useGoogleAgenda } from '../components/useGoogleAgenda';
import { ErroGoogleAgenda } from '../services/googleAgenda';
import { alterarSituacaoVisita, excluirVisita, salvarAgendamento } from '../database/visitas';


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
  const google = useGoogleAgenda(diaSelecionado.slice(0, 7));
  const [avisoGoogle, setAvisoGoogle] = useState<{ mensagem: string; erro: boolean }>();
  const [publicando, setPublicando] = useState(false);
  const travaGoogle = useRef(false);
  const tentativasGoogle = useRef(new Set<string>());
  const exclusoesTentadas = useRef(new Set<string>());
  const [reconexoes, setReconexoes] = useState(0);

  useEffect(() => {
    function reconectar() {
      exclusoesTentadas.current.clear();
      setReconexoes(valor => valor + 1);
    }
    window.addEventListener('online', reconectar);
    return () => window.removeEventListener('online', reconectar);
  }, []);

  function chaveEnvio(visitaId: string) {
    return `campos-google-agenda-envio:${usuarioId}:${visitaId}`;
  }

  async function enviarAoGoogle(visita: Visita, destino: string) {
    if (travaGoogle.current) return;
    travaGoogle.current = true;
    setPublicando(true);
    try {
      localStorage.setItem(chaveEnvio(visita.id), destino);
      const medico = await db.medicos.get(visita.medicoId);
      if (!medico?.nome.trim() || medico.usuarioId !== usuarioId) {
        throw new ErroGoogleAgenda('Não foi possível localizar o nome do médico vinculado.');
      }
      localStorage.setItem(chaveEnvio(visita.id) + ':destino', destino);
      await google.publicar(visita, destino, medico.nome.trim());
      localStorage.removeItem(chaveEnvio(visita.id));
      setAvisoGoogle({ mensagem: 'Visita incluída no Google Agenda.', erro: false });
    } catch (falha) {
      const detalhe = falha instanceof ErroGoogleAgenda ? falha.message : 'Verifique a conexão e tente enviar novamente.';
      setAvisoGoogle({ mensagem: `Visita salva no VisitaFarma. O envio ao Google Agenda ficou pendente. ${detalhe}`, erro: true });
    } finally {
      travaGoogle.current = false;
      setPublicando(false);
    }
  }
  async function removerVisita(visita: Visita) {
    if (travaSituacao.current || travaSalvar.current || travaGoogle.current) return;
    if (!window.confirm('Excluir esta visita do VisitaFarma e do Google Agenda? Ela também sairá dos relatórios de visitas.')) return;
    travaSituacao.current = true;
    setAtualizandoId(visita.id);
    setErroSituacao('');
    try {
      const chave = chaveEnvio(visita.id);
      const destino = localStorage.getItem(chave + ':destino') || localStorage.getItem(chave) || '';
      localStorage.setItem(chave + ':excluir', destino);
      await excluirVisita(usuarioId, visita.id);
      localStorage.removeItem(chave);
      setAvisoGoogle({ mensagem: 'Visita excluída do VisitaFarma. A exclusão no Google Agenda está pendente.', erro: false });
      if (editandoId === visita.id) limparFormulario();
    } catch (erro) {
      setErroSituacao(erro instanceof Error ? erro.message : 'Não foi possível excluir a visita.');
    } finally {
      travaSituacao.current = false;
      setAtualizandoId(undefined);
    }
  }

  const [mostrarFormulario, setMostrarFormulario] =
    useState(Boolean(visitaInicial));

  const [editandoId, setEditandoId] =
    useState<string | null>(visitaInicial?.id ?? null);

  const [medicoId, setMedicoId] = useState(visitaInicial?.medicoId ?? '');
  const [textoMedico, setTextoMedico] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [secretariasEditadas, setSecretariasEditadas] = useState<ContatoSecretaria[]>();
  const [maisDeUmaEditada, setMaisDeUmaEditada] = useState<boolean>();
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
    .filter(s => !s.excluidoEm).sortBy('nome'), [usuarioId]);
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

  const excluirPendente = useEffectEvent(async (visita: Visita, destinos: string[]) => {
    if (travaSalvar.current || travaGoogle.current || travaSituacao.current) return;
    exclusoesTentadas.current.add(visita.id);
    travaGoogle.current = true;
    setPublicando(true);
    const chave = chaveEnvio(visita.id);
    try {
      await google.excluir(visita.id, destinos);
      localStorage.removeItem(chave + ':excluir');
      localStorage.removeItem(chave + ':destino');
      setAvisoGoogle({ mensagem: 'Exclusão da visita concluída no Google Agenda.', erro: false });
    } catch (falha) {
      const detalhe = falha instanceof ErroGoogleAgenda ? falha.message : 'Verifique a conexão.';
      setAvisoGoogle({ mensagem: `A exclusão no Google Agenda ficou pendente. ${detalhe}`, erro: true });
    } finally {
      travaGoogle.current = false;
      setPublicando(false);
    }
  });

  const enviarPendente = useEffectEvent((visita: Visita, destino: string) => {
    if (travaSalvar.current || travaGoogle.current || travaSituacao.current || tentativasGoogle.current.has(visita.id)) return;
    tentativasGoogle.current.add(visita.id);
    void enviarAoGoogle(visita, destino);
  });

  useEffect(() => {
    if (!google.opcoes) {
      exclusoesTentadas.current.clear();
      return;
    }
    if (salvando || publicando || atualizandoId) return;
    const agendasEditaveis = google.opcoes.filter(a => a.accessRole === 'owner' || a.accessRole === 'writer');
    for (const visita of visitas ?? []) {
      if (!visita.excluidoEm || exclusoesTentadas.current.has(visita.id)) continue;
      const destino = localStorage.getItem(`campos-google-agenda-envio:${usuarioId}:${visita.id}:excluir`);
      if (destino === null) continue;
      const destinos = [...new Set([destino, ...agendasEditaveis.map(a => a.id)].filter(Boolean))];
      if (destinos.length) {
        const timer = window.setTimeout(() => { void excluirPendente(visita, destinos); }, 0);
        return () => window.clearTimeout(timer);
      }
    }
    for (const visita of visitas ?? []) {
      if (visita.excluidoEm || visita.status === 'cancelada' || tentativasGoogle.current.has(visita.id)) continue;
      const pendente = localStorage.getItem(`campos-google-agenda-envio:${usuarioId}:${visita.id}`);
      const destino = pendente || google.destino;
      if (pendente === null || !google.opcoes.some(a =>
        a.id === destino && (a.accessRole === 'owner' || a.accessRole === 'writer'))) continue;
      enviarPendente(visita, destino);
      break;
    }
  }, [google.opcoes, google.destino, publicando, salvando, atualizandoId, reconexoes, usuarioId, visitas]);

  const medicosAtivos = (medicos ?? [])
    .filter(m => !m.excluidoEm)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const termoMedico = normalizarNomeMedico(textoMedico);
  const nomesIguais = termoMedico ? medicosAtivos.filter(m => normalizarNomeMedico(m.nome) === termoMedico) : [];
  const medicoSelecionado = medicoId ? medicosAtivos.find(m => m.id === medicoId) :
    nomesIguais.length === 1 ? nomesIguais[0] : undefined;
  const sugestoesMedicos = termoMedico ? medicosAtivos
    .filter(m => correspondeBuscaMedico(m.nome, textoMedico)).slice(0, 8) : [];
  const ordemSecretarias = medicoSelecionado?.secretariaIds ??
    (medicoSelecionado?.secretariaId ? [medicoSelecionado.secretariaId] : []);
  const secretariasVinculadas = (secretarias ?? []).filter(s =>
    (s.medicoIds ?? [s.medicoId]).includes(medicoSelecionado?.id ?? medicoId));
  const posicao = (id: string) => ordemSecretarias.includes(id) ? ordemSecretarias.indexOf(id) : Number.MAX_SAFE_INTEGER;
  const contatos = secretariasVinculadas.sort((a, b) => posicao(a.id) - posicao(b.id))
    .map(({ id, nome }) => ({ id, nome }));
  const camposSecretarias = secretariasEditadas ?? (contatos.length ? contatos : [{ nome: '' }]);
  const maisDeUmaSecretaria = maisDeUmaEditada ?? contatos.length > 1;

  function limparSecretarias() {
    setSecretariasEditadas(undefined);
    setMaisDeUmaEditada(undefined);
  }

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
    setTextoMedico('');
    setMostrarSugestoes(false);
    limparSecretarias();
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
    if (travaSalvar.current || travaGoogle.current) return;
    travaSalvar.current = true; setSalvando(true); setErro('');
    try {
      const camposVisiveis = maisDeUmaSecretaria ? camposSecretarias : camposSecretarias.slice(0, 1);
      const contatosPreenchidos = camposVisiveis.filter(c => c.nome.trim());
      if (!editandoId && maisDeUmaSecretaria &&
        (camposVisiveis.length < 2 || camposVisiveis.length !== contatosPreenchidos.length)) {
        throw new Error('Preencha os nomes das secretárias nos campos exibidos.');
      }
      const alterouSecretarias = secretariasEditadas !== undefined || maisDeUmaEditada !== undefined;
      const visita = await salvarAgendamento(usuarioId, {
        medicoId: editandoId ? medicoId : medicoSelecionado?.id ?? medicoId,
        data, horaInicio, horaFim, local, secretariaId, observacoes, produtosAssuntos
      }, editandoId ?? undefined, atualizadoEmEdicao, editandoId ? undefined : {
        nomeMedico: textoMedico,
        secretarias: alterouSecretarias ? contatosPreenchidos : undefined
      });
      setDiaSelecionado(data); limparFormulario();
      setAvisoGoogle(undefined);
      if (!editandoId) {
        localStorage.setItem(chaveEnvio(visita.id), google.destino);
        if (!google.destino) {
          setAvisoGoogle({ mensagem: 'Visita salva no VisitaFarma. O envio aguarda uma agenda Google com permissão de escrita.', erro: false });
        }
      }
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

          <form onSubmit={salvarVisita}><fieldset disabled={salvando || publicando} className="cadastro-campos">
            <div className="medicos-grid">
              {editandoId ? (
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
              ) : (
                <div onBlur={e => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setMostrarSugestoes(false);
                }} onKeyDown={e => {
                  if (e.key === 'Escape') setMostrarSugestoes(false);
                }}>
                  <label>Médico *
                    <input required autoComplete="off" placeholder="Digite o nome completo" value={textoMedico}
                      onFocus={() => setMostrarSugestoes(!medicoId)}
                      onChange={e => {
                        setTextoMedico(e.target.value);
                        if (medicoId) setLocal('');
                        setMedicoId('');
                        limparSecretarias();
                        setMostrarSugestoes(true);
                      }} />
                  </label>
                  {mostrarSugestoes && sugestoesMedicos.length > 0 &&
                    <div className="agenda-produtos-sugestoes" aria-label="Sugestões de médicos">
                      {sugestoesMedicos.map(m => <button type="button" key={m.id} onClick={() => {
                        setMedicoId(m.id);
                        setTextoMedico(m.nome);
                        setLocal(m.clinica ?? '');
                        limparSecretarias();
                        setMostrarSugestoes(false);
                      }}>{[m.nome, m.especialidade, m.crm && `CRM ${m.crm}`].filter(Boolean).join(' — ')}</button>)}
                    </div>}
                </div>
              )}

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

            {editandoId ? <label>Secretária
              <select value={secretariaId} onChange={e => setSecretariaId(e.target.value)}>
                <option value="">Sem secretária selecionada</option>
                {secretariasVinculadas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label> : <><CamposSecretarias maisDeUmaSecretaria={maisDeUmaSecretaria} camposSecretarias={camposSecretarias}
              setMaisDeUmaSecretaria={setMaisDeUmaEditada} setCamposSecretarias={setSecretariasEditadas} />
              {medicoSelecionado && (secretariasEditadas !== undefined || maisDeUmaEditada !== undefined) &&
                <p>Ao salvar, as alterações nas secretárias serão aplicadas ao cadastro do médico.</p>}
            </>}
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
                disabled={salvando || (!editandoId && (!medicos || !secretarias))}
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
      {avisoGoogle && <p role={avisoGoogle.erro ? 'alert' : 'status'}>{avisoGoogle.mensagem}</p>}
      <CalendarioVisitas visitas={visitas ?? []} medicos={medicos ?? []} selecionado={diaSelecionado} google={google}
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
            {visitasOrdenadas.map(visita => {
              return (
              <article className="agenda-item" key={visita.id}>
                <div className="agenda-item-horario">
                  {visita.horaInicio}
                  <button type="button" className="agenda-botao-excluir"
                    aria-label={`Excluir visita de ${nomeMedico(visita.medicoId)} às ${visita.horaInicio}`}
                    title="Excluir visita" disabled={!!atualizandoId || salvando || publicando}
                    onClick={() => void removerVisita(visita)}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M9 6V3h6v3M5 6l1 14h12l1-14M10 10v6m4-6v6" />
                    </svg>
                  </button>
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
                      onClick={() => void mudarSituacao(visita, 'realizada')}>Visita Realizada</button>
                    <button type="button" disabled={!!atualizandoId} className="agenda-botao-cancelar"
                      onClick={() => void mudarSituacao(visita, 'cancelada')}>Visita Cancelada</button>
                    <button type="button" disabled={!!atualizandoId} onClick={() => editarVisita(visita)}>Visita remarcada</button>
                  </div>}
                  <div className="agenda-acoes-linha">
                    {visita.status !== 'realizada' && visita.status !== 'cancelada' &&
                      <button type="button" disabled={!!atualizandoId} onClick={() => editarVisita(visita)}>Editar</button>}
                    <button type="button" disabled={!!atualizandoId} className="agenda-botao-formulario"
                      onClick={() => abrirRelatorio(visita)}>Formulário</button>
                  </div>
                </div>
                
              </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
