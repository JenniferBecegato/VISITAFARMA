import { aniversariosNoAno } from '../utils/aniversarios';
import { datasNoDia, datasNoMes, legendaDatas, type TipoData } from '../utils/feriados';
import { rotuloStatusVisita } from '../utils/statusVisita';
import type { useGoogleAgenda } from './useGoogleAgenda';
import { idEventoGoogle } from '../services/googleAgenda';
import type { Medico, Visita } from '../database/database';
import { diasDoMes, visitasNaData } from '../utils/calendario';
import { dataLocal } from '../utils/relatorios';
import './CalendarioVisitas.css';
interface Props {
  visitas: Visita[]; medicos: Medico[]; selecionado: string;
  selecionar: (dia: string) => void; agendar: (dia: string) => void;
  google: ReturnType<typeof useGoogleAgenda>;
}
export default function CalendarioVisitas({ visitas, medicos, selecionado, selecionar, agendar, google }: Props) {
  const mesAtual = new Date(`${selecionado}T12:00:00`);
  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth();
  const idsVisitas = new Set(visitas.filter(visita => visita.excluidoEm || visita.status !== 'cancelada')
    .map(visita => `${visita.data}:${idEventoGoogle(visita.id)}`));
  const compromissos = (dia: string) => (google.dias?.[dia] ?? []).filter(evento => !idsVisitas.has(`${dia}:${evento.id}`));
  const compromissosDoDia = compromissos(selecionado);
  const titulo = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const hoje = dataLocal();
  const aniversarios = aniversariosNoAno(medicos, ano);
  const datasDoMes = [...datasNoMes(ano, mes), ...aniversarios.filter(item => Number(item.data.slice(5, 7)) === mes + 1)].sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
  function mover(delta: number) {
    const proximo = new Date(ano, mes + delta, 1);
    selecionar(dataLocal(proximo));
  }
  return <section className="medicos-card calendario" aria-label="Calendário de visitas">
    <header className="calendario-topo"><h2>{titulo}</h2><div>
      <button type="button" aria-label="Mês anterior" onClick={() => mover(-1)}>‹</button>
      <button type="button" onClick={() => selecionar(hoje)}>Hoje</button>
      <button type="button" aria-label="Próximo mês" onClick={() => mover(1)}>›</button>
    </div></header><p className="calendario-ajuda">Selecione um dia para ver as visitas abaixo do calendário. Na lista do dia, clique no nome do médico para abrir sua pasta.</p>
    <div className="calendario-google-controles">
      {google.opcoes?.length ? <label><span>Google Agenda:</span>
        <select value={google.agenda} onChange={evento => google.selecionar(evento.target.value)}>
          <option value="">Ocultar compromissos</option>
          {google.opcoes.map(item => <option key={item.id} value={item.id}>{item.summaryOverride || item.summary}</option>)}
        </select>
      </label> : null}
      {(!google.carregando && !google.opcoes?.length) && <button type="button" disabled={google.autorizando}
        onClick={() => void google.conectar()}>Conectar Google Agenda</button>}
      {google.agenda && !google.podeCriar && <span>Esta agenda permite apenas leitura.</span>}
      {google.carregando && <span role="status">Carregando Google Agenda…</span>}
      {google.opcoes?.length === 0 && <span role="status">Nenhuma agenda disponível nesta conta Google.</span>}
      {google.erro && <span role="alert">{google.erro}</span>}
      {google.erro && google.tentarNovamente && <button type="button" onClick={google.tentarNovamente}>Tentar novamente</button>}
    </div>
    <div className="calendario-legenda" aria-label="Legenda das datas">
      {(Object.keys(legendaDatas) as TipoData[]).map(tipo => <span key={tipo} className={`calendario-data ${tipo}`}>{legendaDatas[tipo]}</span>)}
    </div>
    <div className="calendario-rolagem"><div className="calendario-grade">
      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div className="calendario-semana" key={d}>{d}</div>)}
      {diasDoMes(ano, mes).map((dia, indice) => dia ? <div key={dia} className={`calendario-dia ${dia === hoje ? 'hoje' : ''} ${dia === selecionado ? 'selecionado' : ''}`}>
        <button className="calendario-selecionar" type="button" aria-label={`Ver agenda de ${dia.split('-').reverse().join('/')}`}
          aria-pressed={dia === selecionado} onClick={() => selecionar(dia)} />
        <div className="calendario-dia-topo"><span className="calendario-numero">{Number(dia.slice(-2))}</span>
          <button type="button" className="calendario-agendar" aria-label={`Agendar visita em ${dia.split('-').reverse().join('/')}`} onClick={() => { selecionar(dia); agendar(dia); }}>+</button></div>
        {[...datasNoDia(dia), ...aniversarios.filter(item => item.data === dia)].map(item => <span key={`${item.nome}-${item.tipo}`} className={`calendario-data calendario-data-dia ${item.tipo}`}
          title={`${item.nome} · ${legendaDatas[item.tipo]}`}><span className="calendario-data-nome">{item.nome}</span><span className="calendario-data-mobile">●</span></span>)}
        {visitasNaData(visitas, dia).length > 0 && <span className="calendario-resumo-mobile"
          aria-label={`${visitasNaData(visitas, dia).length} ${visitasNaData(visitas, dia).length === 1 ? "visita" : "visitas"}`}>
          {visitasNaData(visitas, dia).length}<span>{visitasNaData(visitas, dia).length === 1 ? "visita" : "visitas"}</span>
        </span>}
        {visitasNaData(visitas, dia).map(v => <div className={`calendario-evento ${v.status}`} key={v.id}
          title={`${v.horaInicio} · ${medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico'} · ${rotuloStatusVisita(v.status)}`}
          ><span>{v.horaInicio}</span><strong className="calendario-evento-nome">{medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico não encontrado'}</strong><small>{rotuloStatusVisita(v.status)}</small></div>)}
        {compromissos(dia).map(evento => <div className="calendario-evento calendario-google-evento" key={evento.id}
          title={`${evento.horario} · ${evento.nome} · Google Agenda`}>
          <span>{evento.horario}</span><strong className="calendario-evento-nome">{evento.nome}</strong><small>Google Agenda</small>
        </div>)}
        {!!compromissos(dia).length && <span className="calendario-resumo-mobile calendario-google-resumo"
          aria-label={`${compromissos(dia).length} no Google Agenda`}>{compromissos(dia).length}<span>Google</span></span>}
      </div> : <div className="calendario-dia vazio" key={`vazio-${indice}`} />)}
    </div></div>
    {google.agenda && google.dias && <div className="calendario-datas-mes">
      <h3>Google Agenda · {selecionado.split('-').reverse().join('/')}</h3>
      {compromissosDoDia.length ? <ul>{compromissosDoDia.map(evento => <li key={evento.id}>
        <strong>{evento.horario}</strong><span>{evento.nome}</span>
      </li>)}</ul> : <p>Nenhum compromisso do Google neste dia.</p>}
    </div>}
    {(ano === 2026 || ano === 2027 || datasDoMes.length > 0) && <div className="calendario-datas-mes"><h3>Datas do mês · Presidente Prudente / SP</h3>
      {datasDoMes.length ? <ul>{datasDoMes.map(item => <li key={`${item.data}-${item.nome}-${item.tipo}`}>
        <span className={`calendario-data ${item.tipo}`}>{legendaDatas[item.tipo]}</span>
        <strong>{item.data.slice(8)}/{item.data.slice(5, 7)}</strong><span>{item.nome}</span>
      </li>)}</ul> : <p>Nenhuma data da fonte neste mês.</p>}
    </div>}
  </section>;
}
